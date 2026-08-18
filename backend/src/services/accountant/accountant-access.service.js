/**
 * Acesso do contador a clientes (empresas) — boundary BPO Phase 9B.
 */
import { createSupabaseClient } from '../../config/supabase.js';
import { query } from '../../config/pg.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import { assertUserOwnsEmpresa } from '../certificate-repository.js';
import { resolveActorMembershipsForUser } from '../openclaw-bot.service.js';

const getDb = () => createSupabaseClient({ useServiceRole: true });

let assertUserOwnsEmpresaOverride = null;
let resolveMembershipsOverride = null;
let listAccountantClientsOverride = null;

/** @internal testes */
export const __setAccountantAccessDepsForTests = (deps = {}) => {
  assertUserOwnsEmpresaOverride = deps.assertUserOwnsEmpresa ?? null;
  resolveMembershipsOverride = deps.resolveActorMembershipsForUser ?? null;
  listAccountantClientsOverride = deps.listAccountantClients ?? null;
};

/** @internal testes */
export const __resetAccountantAccessDepsForTests = () => {
  assertUserOwnsEmpresaOverride = null;
  resolveMembershipsOverride = null;
  listAccountantClientsOverride = null;
};

const resolveMemberships = (userId) => (
  resolveMembershipsOverride
    ? resolveMembershipsOverride(userId)
    : resolveActorMembershipsForUser(userId)
);

const assertEmpresaMembership = (userId, empresaId) => (
  assertUserOwnsEmpresaOverride
    ? assertUserOwnsEmpresaOverride(userId, empresaId)
    : assertUserOwnsEmpresa(userId, empresaId)
);

export const assertEmpresaExists = async (empresaId) => {
  const normalized = String(empresaId || '').trim();
  if (!normalized) throw badRequest('empresaId obrigatório');
  const db = getDb();
  const { data, error } = await db
    .from('empresas')
    .select('id')
    .eq('id', normalized)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data?.id) throw notFound('Empresa não encontrada');
  return data.id;
};

/**
 * Valida que o usuário pode operar no tenant informado.
 * Superadmin: qualquer empresa existente.
 * Demais: vínculo ativo em role_x_user_x_empresa.
 */
export const assertUserCanAccessEmpresa = async (userId, empresaId) => {
  if (!userId || !empresaId) throw forbidden('Acesso negado ao cliente');
  const memberships = await resolveMemberships(userId);
  if (memberships.hasSuperadminCapability) {
    await assertEmpresaExists(empresaId);
    return memberships;
  }
  await assertEmpresaMembership(userId, empresaId);
  return memberships;
};

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const formatCnpjLabel = (value) => {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return digits || String(value ?? '').trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const buildFiscalEmitterLabel = (row) => {
  const establishmentCnpj = digitsOnly(row.establishment_id);
  const formatted = formatCnpjLabel(establishmentCnpj);
  const tradeName = String(
    row.cert_fantasia
    ?? row.cert_razao
    ?? row.user_nome
    ?? row.nome_fantasia
    ?? row.razao_social
    ?? row.empresa
    ?? '',
  ).trim();
  return tradeName ? `${tradeName} · ${formatted}` : formatted;
};

const parseCrtValue = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : normalized;
};

const normalizeTradeName = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/** Escritório contábil (matriz) — excluir só quando o certificado é do próprio escritório. */
const isAccountantOfficeMatriz = (row, siblingCount) => {
  if (siblingCount <= 1) return false;
  const estCnpj = digitsOnly(row.establishment_id);
  const empresaCnpj = digitsOnly(row.empresa_cnpj);
  if (!estCnpj || !empresaCnpj || estCnpj !== empresaCnpj) return false;

  const certName = normalizeTradeName(
    row.cert_razao ?? row.cert_fantasia ?? row.user_nome,
  );
  const officeName = normalizeTradeName(
    row.razao_social ?? row.nome_fantasia ?? row.empresa,
  );
  if (!certName || !officeName) return true;
  if (certName === officeName) return true;
  if (certName.includes(officeName) || officeName.includes(certName)) return true;
  return false;
};

/**
 * Emissores elegíveis — usuário com emissão liberada (mei), Simples ativo (max_mei)
 * e CRT importado via certificado A1 (user_mei_certificates.regime_tributario).
 * Exclui CNPJ matriz do escritório quando há outros emissores no mesmo tenant.
 */
const listAccountantFiscalEmitters = async (empresaIds) => {
  if (!empresaIds.length) return [];

  const result = await query(
    `SELECT DISTINCT ON (rx.empresas_id, rx.user_id)
      e.id AS empresa_id,
      e.empresa,
      e.razao_social,
      e.nome_fantasia,
      e.cnpj AS empresa_cnpj,
      regexp_replace(umc.cert_document, '\\D', '', 'g') AS establishment_id,
      umc.regime_tributario AS crt,
      umc.optante_simples_nacional,
      umc.razao_social AS cert_razao,
      umc.nome_fantasia AS cert_fantasia,
      COALESCE(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
      ) AS user_nome,
      umc.status AS cert_status,
      rx.user_id AS emitter_user_id
    FROM role_x_user_x_empresa rx
    INNER JOIN empresas e ON e.id = rx.empresas_id
    INNER JOIN user_mei_certificates umc ON umc.user_id = rx.user_id
    INNER JOIN users u ON u.id = rx.user_id
    WHERE rx.empresas_id = ANY($1::uuid[])
      AND rx.mei = true
      AND COALESCE(rx.status, true) = true
      AND COALESCE(e.max_mei, 0) > 0
      AND e.status = 'active'
      AND COALESCE(umc.status, 'VALIDO') = 'VALIDO'
      AND umc.cert_document IS NOT NULL
      AND length(regexp_replace(umc.cert_document, '\\D', '', 'g')) = 14
      AND (
        NULLIF(trim(umc.regime_tributario), '') IS NOT NULL
        OR COALESCE(umc.optante_simples_nacional, false) = true
      )
    ORDER BY rx.empresas_id, rx.user_id, umc.updated_at DESC NULLS LAST`,
    [empresaIds],
  );

  let rows = result.rows ?? [];

  if (rows.length === 0) {
    const profileResult = await query(
      `SELECT DISTINCT ON (cfp.tenant_id, cfp.establishment_id)
        e.id AS empresa_id,
        e.empresa,
        e.razao_social,
        e.nome_fantasia,
        e.cnpj AS empresa_cnpj,
        cfp.establishment_id,
        cfp.crt::text AS crt,
        cfp.status AS profile_status
      FROM company_fiscal_profiles cfp
      INNER JOIN empresas e ON e.id = cfp.tenant_id
      WHERE cfp.tenant_id = ANY($1::uuid[])
        AND cfp.establishment_id IS NOT NULL
        AND cfp.establishment_id <> 'default'
        AND cfp.crt IS NOT NULL
        AND COALESCE(e.max_mei, 0) > 0
        AND e.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM role_x_user_x_empresa rx
          WHERE rx.empresas_id = e.id
            AND rx.mei = true
        )
      ORDER BY cfp.tenant_id, cfp.establishment_id, cfp.valid_from DESC NULLS LAST`,
      [empresaIds],
    );
    rows = profileResult.rows ?? [];
  }

  const byTenant = new Map();
  for (const row of rows) {
    const tenantId = String(row.empresa_id);
    if (!byTenant.has(tenantId)) byTenant.set(tenantId, []);
    byTenant.get(tenantId).push(row);
  }

  const filtered = rows.filter((row) => {
    const tenantId = String(row.empresa_id);
    const siblings = byTenant.get(tenantId) ?? [];
    return !isAccountantOfficeMatriz(row, siblings.length);
  });

  const usedClientKeys = new Set();

  return filtered.map((row) => {
    const establishmentId = digitsOnly(row.establishment_id);
    const empresaId = String(row.empresa_id);
    const emitterUserId = String(row.emitter_user_id ?? '');
    let clientKey = `${empresaId}:${establishmentId}`;
    if (usedClientKeys.has(clientKey) && emitterUserId) {
      clientKey = `${empresaId}:${establishmentId}:${emitterUserId}`;
    }
    usedClientKeys.add(clientKey);
    return {
      empresaId,
      establishmentId,
      clientKey,
      emitterUserId: emitterUserId || null,
      razaoSocial: row.cert_razao ?? row.razao_social ?? row.empresa ?? null,
      nomeFantasia: row.cert_fantasia ?? row.nome_fantasia ?? null,
      cpfCnpj: establishmentId || null,
      crt: parseCrtValue(row.crt) ?? (row.optante_simples_nacional ? 1 : null),
      status: row.cert_status ?? row.profile_status ?? null,
      label: buildFiscalEmitterLabel(row),
    };
  });
};

const resolveAccessibleEmpresaIds = async (userId, memberships) => {
  if (memberships.hasSuperadminCapability) {
    const db = getDb();
    const { data, error } = await db
      .from('empresas')
      .select('id')
      .eq('status', 'active');
    if (error) throw badRequest(error.message);
    return (data || []).map((row) => row.id).filter(Boolean);
  }

  return [...new Set(
    (memberships.memberships || [])
      .map((m) => m.empresaId)
      .filter(Boolean),
  )];
};

/**
 * Lista clientes acessíveis ao contador — emissores fiscais (CNPJ + CRT), não o escritório contábil.
 */
export const listAccountantClients = async (userId) => {
  if (listAccountantClientsOverride) {
    return listAccountantClientsOverride(userId);
  }
  if (!userId) throw badRequest('Usuário não identificado');

  const memberships = await resolveMemberships(userId);
  const empresaIds = await resolveAccessibleEmpresaIds(userId, memberships);
  if (empresaIds.length === 0) return [];

  try {
    const emitters = await listAccountantFiscalEmitters(empresaIds);
    return emitters;
  } catch (error) {
    console.warn(
      '[accountant] Falha ao listar emissores fiscais.',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
};

/**
 * Usuários vinculados à empresa — catálogo mei_nfse_produtos é scoped por user_id.
 * @param {string} empresaId
 * @returns {Promise<string[]>}
 */
export const resolveEmpresaCatalogUserIds = async (empresaId) => {
  const normalized = String(empresaId || '').trim();
  if (!normalized) return [];
  const result = await query(
    `SELECT DISTINCT rx.user_id
     FROM public.role_x_user_x_empresa rx
     WHERE rx.empresas_id = $1`,
    [normalized],
  );
  return result.rows.map((row) => row.user_id).filter(Boolean);
};

/**
 * Usuários cujo catálogo o ator pode ver/emitir — inclui todos os vínculos da mesma empresa.
 * Produtos criados pelo contador BPO usam resolveEmpresaCatalogOwnerUserId (ex.: role usuario).
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export const resolveCatalogUserIdsForActor = async (userId) => {
  const normalized = String(userId || '').trim();
  if (!normalized) return [];

  const result = await query(
    `SELECT DISTINCT rx.empresas_id AS empresa_id
     FROM public.role_x_user_x_empresa rx
     WHERE rx.user_id = $1`,
    [normalized],
  );

  const userIds = new Set([normalized]);
  for (const row of result.rows) {
    const empresaId = row?.empresa_id;
    if (!empresaId) continue;
    const linked = await resolveEmpresaCatalogUserIds(empresaId);
    linked.forEach((id) => userIds.add(id));
  }
  return [...userIds];
};

export const resolveEmpresaCatalogOwnerUserId = async (empresaId) => {
  const normalized = String(empresaId || '').trim();
  if (!normalized) throw badRequest('empresaId obrigatório');
  const result = await query(
    `SELECT rx.user_id, r.roles
     FROM public.role_x_user_x_empresa rx
     JOIN public.roles r ON r.id = rx.roles_id
     WHERE rx.empresas_id = $1
     ORDER BY CASE r.roles
       WHEN 'usuario' THEN 0
       WHEN 'admin' THEN 1
       ELSE 2
     END, rx.user_id
     LIMIT 1`,
    [normalized],
  );
  const ownerId = result.rows[0]?.user_id;
  if (!ownerId) {
    throw badRequest('Cliente sem usuário vinculado para catálogo de produtos');
  }
  return ownerId;
};

/**
 * Usuário MEI cujo catálogo comercial corresponde ao emissor selecionado (BPO).
 * @param {string} empresaId
 * @param {string} emitterUserId
 * @returns {Promise<string>}
 */
export const resolveEmitterCatalogUserId = async (empresaId, emitterUserId) => {
  const tenantId = String(empresaId || '').trim();
  const userId = String(emitterUserId || '').trim();
  if (!tenantId) throw badRequest('empresaId obrigatório');
  if (!userId) throw badRequest('emitterUserId obrigatório');

  const result = await query(
    `SELECT 1
     FROM public.role_x_user_x_empresa rx
     WHERE rx.empresas_id = $1
       AND rx.user_id = $2
       AND rx.mei = true
     LIMIT 1`,
    [tenantId, userId],
  );
  if (!result.rows[0]) {
    throw badRequest('Emissor não vinculado ao cliente ou sem perfil MEI');
  }
  return userId;
};


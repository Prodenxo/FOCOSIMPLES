import { createSupabaseClient } from '../config/supabase.js';
// [auto-restart trigger]
import { badRequest, forbidden, serviceUnavailable, unauthorized } from '../utils/errors.js';
import { isSupabaseAuthNetworkError as isSupabaseNetworkError } from '../utils/verifySupabaseAccessToken.js';
import {
  assertStrongPassword,
  generateStrongRandomPassword
} from '../utils/passwordPolicy.js';
import * as authService from './auth.service.js';
import { assignN8nPhoneToUser } from './n8n-link-phone.service.js';
import {
  deriveEmpresaProductLine,
  deriveUserProductLine,
  isEmpresaMeiModuleActive,
  isFocoMeiApiDeploy,
  isMeiSlotUserLink,
} from '../utils/product-line.js';

const ROLE_CREATE_ALLOWED = new Set(['superadmin', 'admin']);
const ROLE_TARGET_ALLOWED = new Set(['admin', 'usuario', 'outsider']);
/** Perfis que um admin da empresa pode criar/editar na própria empresa */
const ROLE_ADMIN_MANAGEABLE = new Set(['usuario', 'admin']);
const ROLE_UPDATE_ALLOWED_SUPERADMIN = new Set(['admin', 'usuario', 'outsider']);
const ROLE_DEFAULT = 'usuario';
const EMPRESA_SELECT_FIELDS = [
  'id',
  'empresa',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'inscricao_estadual',
  'regime_tributario',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'telefone',
  'email',
  'max_mei',
  'max_usuarios_nao_mei',
  'legacy_mei_slots_pix'
].join(', ');
const EMPRESA_TEXT_FIELDS = [
  'empresa',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'inscricao_estadual',
  'regime_tributario',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'telefone',
  'email'
];

const normalizeRoleValue = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'user') return 'usuario';
  return normalized;
};

const getRoleCandidates = (role) => {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return [];
  if (normalized === 'usuario') return ['user', 'usuario'];
  return [normalized];
};

const findRoleByCandidates = async (adminClient, candidates) => {
  if (candidates.length === 0) return null;

  const filters = candidates
    .map((candidate) => `roles.ilike.${candidate}`)
    .join(',');

  const { data, error } = await adminClient
    .from('roles')
    .select('id, roles')
    .or(filters)
    .limit(1)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data?.id) return null;

  return { roleId: data.id, role: normalizeRoleValue(data.roles) };
};

export const ensureRoleId = async (adminClient, role) => {
  const resolved = await findRoleByCandidates(adminClient, getRoleCandidates(role));
  if (resolved?.roleId) return resolved;

  const fallback = await findRoleByCandidates(adminClient, getRoleCandidates(ROLE_DEFAULT));
  if (fallback?.roleId && normalizeRoleValue(role) && normalizeRoleValue(role) !== ROLE_DEFAULT) {
    console.warn('[Users] role fallback:', { requestedRole: role, resolvedRole: fallback.role });
  }
  return fallback || { roleId: null, role: null };
};

import { canonicalizeBrazilWhatsappPhone } from '../utils/whatsapp-phone.js';

const cleanPhone = (phone) => {
  if (!phone) return '';
  return canonicalizeBrazilWhatsappPhone(phone);
};
const normalizeEmpresaText = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};
const normalizeCnpj = (value) => {
  const normalized = normalizeEmpresaText(value);
  if (normalized === undefined) return undefined;
  if (normalized === null) return null;
  const digits = normalized.replace(/\D/g, '');
  return digits || null;
};
const resolveEmpresaName = (input) => {
  const preferred = normalizeEmpresaText(input?.empresa);
  if (preferred) return preferred;
  const fromRazao = normalizeEmpresaText(input?.razao_social);
  if (fromRazao) return fromRazao;
  const fromFantasia = normalizeEmpresaText(input?.nome_fantasia);
  if (fromFantasia) return fromFantasia;
  return null;
};

const normalizeLimitInput = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw badRequest(`${fieldName} deve ser um inteiro valido`);
  }
  if (numeric < 0) {
    throw badRequest(`${fieldName} deve ser maior ou igual a 0`);
  }
  return numeric;
};

/** max_mei: 0 = módulo MEI desligado; inteiro >= 1 = quantidade de vagas. */
const normalizeMaxMeiInput = (value, fieldName = 'max_mei') => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw badRequest(`${fieldName} deve ser um inteiro valido`);
  }
  if (numeric < 0) {
    throw badRequest(`${fieldName} deve ser maior ou igual a 0`);
  }
  return numeric;
};

const normalizeMaxMeiStored = (value) => {
  if (value === undefined || value === null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.trunc(numeric);
};

// max_usuarios_nao_mei nunca teve "0" como estado intencional — o frontend sempre
// exibiu 0 como ILIMITADO, mas o backend tratava como limite zero e bloqueava tudo.
// Aqui sanitizamos 0 → null para garantir a única semântica suportada: null = ilimitado.
const normalizeNaoMeiLimitInput = (value, fieldName) => {
  const normalized = normalizeLimitInput(value, fieldName);
  return normalized === 0 ? null : normalized;
};

const normalizeLimitValue = (value) => {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

/** Inteiro >= 0 — vagas MEI legadas (PIX) registadas pelo superadmin. */
const normalizeLegacyMeiSlotsPixInput = (value, fieldName = 'legacy_mei_slots_pix') => {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw badRequest(`${fieldName} deve ser um inteiro maior ou igual a 0`);
  }
  return numeric;
};
const buildEmpresaPayload = (input = {}, { requireName = false } = {}) => {
  const payload = {};
  for (const field of EMPRESA_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    payload[field] = field === 'cnpj'
      ? normalizeCnpj(input[field])
      : normalizeEmpresaText(input[field]);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'max_mei')) {
    payload.max_mei = normalizeMaxMeiInput(input.max_mei, 'max_mei');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'max_usuarios_nao_mei')) {
    payload.max_usuarios_nao_mei = normalizeNaoMeiLimitInput(
      input.max_usuarios_nao_mei,
      'max_usuarios_nao_mei'
    );
  }
  if (Object.prototype.hasOwnProperty.call(input, 'legacy_mei_slots_pix')) {
    payload.legacy_mei_slots_pix = normalizeLegacyMeiSlotsPixInput(input.legacy_mei_slots_pix);
  }

  if (requireName) {
    payload.empresa = resolveEmpresaName({ ...input, empresa: payload.empresa ?? input?.empresa });
    if (!payload.empresa) throw badRequest('Empresa e obrigatoria');
  }

  return payload;
};
const getEmpresaRecordById = async (adminClient, empresaId) => {
  const { data, error } = await adminClient
    .from('empresas')
    .select(EMPRESA_SELECT_FIELDS)
    .eq('id', empresaId)
    .maybeSingle();
  if (error) throw badRequest(error.message || 'Erro ao carregar empresa');
  if (!data?.id) throw badRequest('Empresa nao encontrada');
  return data;
};

const resolveMeiValue = (value, defaultValue = false) => (
  typeof value === 'boolean' ? value : defaultValue
);

/** Vaga MEI ocupada só quando `role_x_user_x_empresa.mei === true`. */
const isMeiSlotActive = (value) => value === true;

/** Consulta direta ao vínculo ativo — evita carregar toda a lista de utilizadores no admin MEI. */
export const isUserMeiSlotActive = async (userId) => {
  if (!userId) return false;
  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await adminClient
    .from('role_x_user_x_empresa')
    .select('mei')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  return isMeiSlotActive(data?.mei);
};

const isUnlimitedLimit = (value) => value === null;

const getEmpresaLimits = async (adminClient, empresaId) => {
  if (!empresaId) throw badRequest('Empresa e obrigatoria');

  const { data, error } = await adminClient
    .from('empresas')
    .select('id, max_mei, max_usuarios_nao_mei')
    .eq('id', empresaId)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data?.id) throw badRequest('Empresa nao encontrada');

  return {
    maxMei: normalizeMaxMeiStored(data.max_mei),
    maxNaoMei: normalizeLimitValue(data.max_usuarios_nao_mei)
  };
};

const countActiveUsersByMei = async (adminClient, { empresaId, mei, ignoreUserId }) => {
  let query = adminClient
    .from('role_x_user_x_empresa')
    .select('id', { count: 'exact', head: true })
    .eq('empresas_id', empresaId)
    .eq('status', true);

  if (mei) {
    query = query.eq('mei', true);
  } else {
    query = query.eq('mei', false);
  }

  if (ignoreUserId) {
    query = query.neq('user_id', ignoreUserId);
  }

  const { count, error } = await query;
  if (error) throw badRequest(error.message);
  return count || 0;
};

const sumActiveStripeMeiSlotsByEmpresa = async (adminClient, empresaIds) => {
  const uniqueIds = Array.from(new Set((empresaIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const { data: lines, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .select('empresa_id, mei_slots')
    .in('empresa_id', uniqueIds)
    .eq('status', 'active');

  if (error) throw badRequest(error.message);

  const sumByEmpresa = new Map();
  for (const row of lines || []) {
    const id = row?.empresa_id;
    if (!id) continue;
    sumByEmpresa.set(id, (sumByEmpresa.get(id) || 0) + Number(row.mei_slots || 0));
  }
  return sumByEmpresa;
};

/**
 * Corrige vínculos/empresas com MEI “fantasma”.
 * Cadastro antigo criava `max_mei: 1` em todo pedido de acesso; o vínculo vinha com `mei: false`,
 * mas a UI tratava admin como liberado. Aqui: links mei=true/null → false quando módulo desligado;
 * `max_mei` > 0 sem ninguém com `mei=true` → volta para 0 (venda MEI é manual no admin).
 */
export const reconcileMeiModuleConsistency = async (
  adminClient,
  scopedEmpresaIds = [],
  options = {}
) => {
  const dryRun = options.dryRun === true;
  const uniqueIds = Array.from(new Set((scopedEmpresaIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { clearedLinks: 0, resetEmpresas: 0, details: [] };
  }

  const { data: empresas, error: empresasError } = await adminClient
    .from('empresas')
    .select('id, max_mei')
    .in('id', uniqueIds);

  if (empresasError) throw badRequest(empresasError.message);

  const stripeByEmpresa = await sumActiveStripeMeiSlotsByEmpresa(adminClient, uniqueIds);
  const details = [];
  let clearedLinks = 0;
  let resetEmpresas = 0;

  for (const empresa of empresas || []) {
    const empresaId = empresa.id;
    const stripeSlots = stripeByEmpresa.get(empresaId) || 0;
    const dbMax = normalizeMaxMeiStored(empresa.max_mei);
    const moduleShouldBeOff = dbMax <= 0 && stripeSlots <= 0;

    if (moduleShouldBeOff) {
      const { data: staleLinks, error: staleError } = await adminClient
        .from('role_x_user_x_empresa')
        .select('id, user_id, mei')
        .eq('empresas_id', empresaId)
        .eq('status', true)
        .or('mei.is.null,mei.eq.true');

      if (staleError) throw badRequest(staleError.message);

      const linkIds = (staleLinks || []).map((link) => link.id).filter(Boolean);
      if (linkIds.length > 0) {
        clearedLinks += linkIds.length;
        details.push({ empresaId, action: 'clear_link_mei', linkIds, dryRun });
        if (!dryRun) {
          const { error: updError } = await adminClient
            .from('role_x_user_x_empresa')
            .update({ mei: false })
            .in('id', linkIds);
          if (updError) throw badRequest(updError.message);
        }
      }
    }

    // NOTE: Removed auto-reset of max_mei→0 when no active MEI users exist.
    // The admin must be able to pre-configure MEI slots before linking users.
    // max_mei is only set to 0 explicitly via the EmpresaModal toggle.
  }

  return { clearedLinks, resetEmpresas, details };
};

/** @deprecated substituído por reconcileMeiModuleConsistency — mantém assinatura para listEmpresas. */
const syncEmpresasMeiActivation = async (adminClient, scopedEmpresaIds = []) => {
  const result = await reconcileMeiModuleConsistency(adminClient, scopedEmpresaIds);
  const fixedMaxMeiByEmpresa = new Map();
  for (const detail of result.details) {
    if (detail.action === 'reset_max_mei' && !detail.dryRun) {
      fixedMaxMeiByEmpresa.set(detail.empresaId, detail.to);
    }
  }
  return fixedMaxMeiByEmpresa;
};

/**
 * Garante que `max_mei` ≥ soma dos pacotes Stripe ativos (evita tabela presa em valor antigo se webhook falhou).
 * Não reduz limite manual acima da Stripe: `max_mei = max(cadastro, soma_ativa)`.
 */
const mergeStripeContractedMeiIntoEmpresaLimits = async (adminClient, empresas) => {
  const list = empresas || [];
  if (list.length === 0) return list;

  const ids = list.map((e) => e.id).filter(Boolean);
  const { data: lines, error } = await adminClient
    .from('empresa_mei_subscription_lines')
    .select('empresa_id, mei_slots')
    .in('empresa_id', ids)
    .eq('status', 'active');

  if (error) throw badRequest(error.message);

  const sumByEmpresa = new Map();
  for (const row of lines || []) {
    const id = row?.empresa_id;
    if (!id) continue;
    sumByEmpresa.set(id, (sumByEmpresa.get(id) || 0) + Number(row.mei_slots || 0));
  }

  const updatePromises = [];
  const merged = list.map((e) => {
    const stripeSum = sumByEmpresa.get(e.id) || 0;
    const dbMax = normalizeMaxMeiStored(e.max_mei);
    const nextMax = Math.max(dbMax, stripeSum);
    if (stripeSum > 0 && nextMax !== dbMax) {
      updatePromises.push(
        adminClient.from('empresas').update({ max_mei: nextMax }).eq('id', e.id)
      );
      return { ...e, max_mei: nextMax };
    }
    return e;
  });

  if (updatePromises.length > 0) {
    const results = await Promise.all(updatePromises);
    const firstErr = results.find((r) => r.error);
    if (firstErr?.error) throw badRequest(firstErr.error.message);
  }

  return merged;
};

export const ensureEmpresaCapacity = async (adminClient, { empresaId, mei, ignoreUserId }) => {
  const { maxMei, maxNaoMei } = await getEmpresaLimits(adminClient, empresaId);
  const limit = mei ? maxMei : maxNaoMei;

  if (mei && limit <= 0) {
    throw badRequest('Modulo MEI desativado para esta empresa');
  }

  if (!mei && isUnlimitedLimit(limit)) return;
  // Para max_usuarios_nao_mei, 0 legado é tratado como ilimitado (migration 20260514120000
  // limpou registros existentes; este guard cobre qualquer 0 residual). max_mei mantém
  // 0 = módulo desligado, então o caminho continua válido para esse caso.
  if (!mei && limit === 0) return;

  const total = await countActiveUsersByMei(adminClient, { empresaId, mei, ignoreUserId });
  if (total >= limit) {
    throw badRequest(
      mei
        ? 'Limite de MEI atingido para esta empresa'
        : 'Limite de usuarios nao MEI atingido para esta empresa'
    );
  }
};

/**
 * Convite por empresa (US-INV-03): bloqueia contas administrativas e quem já tem vínculo ativo.
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} userId
 */
export const assertUserEligibleForEmpresaInvite = async (adminClient, userId) => {
  if (!userId) throw badRequest('Usuário inválido');

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) throw badRequest(profileErr.message);

  const profileRole = normalizeRoleValue(profile?.role);
  if (profileRole === 'admin' || profileRole === 'superadmin') {
    throw forbidden('Contas administrativas não podem aceitar convite de usuário');
  }

  const { data: activeLink, error: linkErr } = await adminClient
    .from('role_x_user_x_empresa')
    .select('id, empresas_id')
    .eq('user_id', userId)
    .eq('status', true)
    .limit(1)
    .maybeSingle();

  if (linkErr) throw badRequest(linkErr.message);
  
  // Se já tem empresa vinculada, bloqueia. Se tem vínculo mas empresas_id é null, permite (foi criado no signup).
  if (activeLink?.id && activeLink.empresas_id != null) {
    throw badRequest('Esta conta já está vinculada a uma empresa');
  }
};

const matchesUserSearch = (user, { empresaName, roleLabel }, searchTerm) => {
  if (!searchTerm) return true;
  const lower = searchTerm.toLowerCase();
  const digits = searchTerm.replace(/\D/g, '');
  const textFields = [
    user?.email,
    user?.displayName,
    user?.phone,
    empresaName,
    roleLabel,
    user?.id,
  ];

  if (textFields.some((field) => String(field || '').toLowerCase().includes(lower))) {
    return true;
  }

  if (digits.length >= 2) {
    const phoneDigits = String(user?.phone || '').replace(/\D/g, '');
    if (phoneDigits.includes(digits)) return true;
    return textFields.some((field) =>
      String(field || '').replace(/\D/g, '').includes(digits),
    );
  }

  return false;
};

export const getRequesterContext = async (accessToken, preverifiedUser = null) => {
  if (!accessToken && !preverifiedUser?.id) throw unauthorized();

  let user = preverifiedUser?.id ? preverifiedUser : null;
  if (!user?.id) {
    const userClient = createSupabaseClient({ accessToken });
    const { data: { user: fetched } = {}, error: userError } = await userClient.auth.getUser();
    if (userError || !fetched) throw unauthorized();
    user = fetched;
  }

  const linkClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData, error: linkError } = await linkClient
    .from('role_x_user_x_empresa')
    .select('id, empresas_id, roles_id, status, mei, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) {
    console.warn('[Users] role_x_user_x_empresa lookup error:', linkError.message);
    if (isSupabaseNetworkError(linkError)) {
      throw serviceUnavailable(
        'Não foi possível verificar suas permissões. Verifique a conexão com o Supabase e tente novamente.',
        { code: 'supabase_upstream_timeout' },
      );
    }
  }

  if (linkData?.roles_id) {
    if (linkData?.status === false) {
      throw forbidden('Seu perfil está bloqueado', { code: 'PROFILE_BLOCKED' });
    }
    if (linkData?.expires_at && new Date(linkData.expires_at) < new Date()) {
      if (linkData?.id) {
        await linkClient
          .from('role_x_user_x_empresa')
          .update({ status: false })
          .eq('id', linkData.id);
      }
      throw forbidden('Seu acesso expirou', { code: 'ACCESS_EXPIRED' });
    }
    const { data: roleData, error: roleError } = await linkClient
      .from('roles')
      .select('roles')
      .eq('id', linkData.roles_id)
      .maybeSingle();

    if (roleError) {
      console.warn('[Users] roles lookup error:', roleError.message);
    }

    if (roleData?.roles) {
      if (linkData.empresas_id && (linkData.mei === true || linkData.mei === null)) {
        await reconcileMeiModuleConsistency(linkClient, [linkData.empresas_id]);
        const { data: refreshedLink } = await linkClient
          .from('role_x_user_x_empresa')
          .select('mei')
          .eq('id', linkData.id)
          .maybeSingle();
        if (typeof refreshedLink?.mei === 'boolean') {
          linkData.mei = refreshedLink.mei;
        }
      }

      const mei = typeof linkData?.mei === 'boolean' ? linkData.mei : false;
      return {
        userId: user.id,
        role: normalizeRoleValue(roleData.roles),
        empresaId: linkData.empresas_id || null,
        mei
      };
    }
  }

  const { data: profile, error: profileError } = await linkClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.warn('[Users] profiles lookup error:', profileError.message);
    if (isSupabaseNetworkError(profileError)) {
      throw serviceUnavailable(
        'Não foi possível verificar suas permissões. Verifique a conexão com o Supabase e tente novamente.',
        { code: 'supabase_upstream_timeout' },
      );
    }
  }

  return {
    userId: user.id,
    role: normalizeRoleValue(profile?.role) || 'usuario',
    empresaId: null,
    mei: false
  };
};

const SUPABASE_ROWS_PAGE = 1000;
const AUTH_LIST_USERS_PAGE = 1000;
const AUTH_LIST_USERS_MAX_PAGES = 100;

const toAuthUserSummary = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.user_metadata?.display_name || null,
  phone: user.user_metadata?.phone || null
});

const fetchAllEmpresaUserLinks = async (adminClient, { role, empresaId }) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query = adminClient
      .from('role_x_user_x_empresa')
      .select('user_id, empresas_id, roles_id, status, mei, expires_at')
      .range(from, from + SUPABASE_ROWS_PAGE - 1);

    if (role === 'admin') {
      if (!empresaId) throw forbidden();
      query = query.eq('empresas_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw badRequest(error.message);
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < SUPABASE_ROWS_PAGE) break;
    from += SUPABASE_ROWS_PAGE;
  }

  return rows;
};

/**
 * Monta mapa id → dados do Auth para todos os IDs pedidos (sem teto artificial de 500).
 * Varre listUsers paginado e só usa getUserById para faltantes raros.
 */
const buildAuthUserMapForIds = async (adminClient, userIds, seedUsers = []) => {
  const userMap = new Map();

  for (const user of seedUsers) {
    userMap.set(user.id, toAuthUserSummary(user));
  }

  const needed = new Set(userIds.filter((id) => id && !userMap.has(id)));
  if (needed.size === 0) return userMap;

  let page = 1;
  while (needed.size > 0 && page <= AUTH_LIST_USERS_MAX_PAGES) {
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_LIST_USERS_PAGE
    });
    if (error || !users?.length) break;

    for (const user of users) {
      if (!needed.has(user.id)) continue;
      userMap.set(user.id, toAuthUserSummary(user));
      needed.delete(user.id);
    }

    if (users.length < AUTH_LIST_USERS_PAGE) break;
    page += 1;
  }

  if (needed.size > 0) {
    const leftover = [...needed];
    const chunkSize = 25;
    for (let offset = 0; offset < leftover.length; offset += chunkSize) {
      const chunk = leftover.slice(offset, offset + chunkSize);
      await Promise.all(chunk.map(async (id) => {
        const { data } = await adminClient.auth.admin.getUserById(id);
        if (data?.user) {
          userMap.set(id, toAuthUserSummary(data.user));
        }
      }));
    }
  }

  return userMap;
};

export const listUsers = async (accessToken, queryParams = {}) => {
  const { search } = queryParams;
  const { role, empresaId } = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(role)) throw forbidden();

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const searchTerm = search?.toLowerCase().trim();

  // 1. Usuários do Auth que batem com a busca (órfãos só entram quando há search + superadmin).
  let allAuthUsers = [];
  if (searchTerm) {
    if (searchTerm.length >= 3) {
      const { data: filteredData, error: filterError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 100,
        filter: searchTerm,
      });
      if (!filterError && filteredData?.users?.length) {
        allAuthUsers = filteredData.users;
      }
    }

    if (allAuthUsers.length === 0) {
      let page = 1;
      const MAX_AUTH_PAGES = 30;

      while (page <= MAX_AUTH_PAGES) {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
        if (error || !users || users.length === 0) break;

        const matches = users.filter((u) =>
          matchesUserSearch(
            {
              id: u.id,
              email: u.email,
              displayName: u.user_metadata?.display_name || null,
              phone: u.user_metadata?.phone || null,
            },
            { empresaName: null, roleLabel: null },
            searchTerm,
          ),
        );
        allAuthUsers = allAuthUsers.concat(matches);
        if (allAuthUsers.length > 200) break;
        page++;
      }
    }
  }

  // 2. Obter links de empresas (paginado — PostgREST limita ~1000 linhas por request)
  const links = await fetchAllEmpresaUserLinks(adminClient, { role, empresaId });

  const scopedEmpresaIds = Array.from(
    new Set((links || []).map((link) => link.empresas_id).filter(Boolean))
  );
  if (scopedEmpresaIds.length > 0) {
    await syncEmpresasMeiActivation(adminClient, scopedEmpresaIds);
  }

  const linkedUserIds = new Set((links || []).map(l => l.user_id));

  // 3. Se houver busca e for Superadmin, incluir usuários do Auth que NÃO estão nos links (órfãos)
  if (searchTerm && role === 'superadmin') {
    for (const au of allAuthUsers) {
      if (!linkedUserIds.has(au.id)) {
        // Adicionar um link "fictício" para representar o usuário sem empresa
        links.push({
          user_id: au.id,
          empresas_id: null,
          roles_id: null,
          status: true,
          mei: false,
          expires_at: null,
          isOrphan: true
        });
      }
    }
  }

  // 4. Filtrar links se houver busca (caso a busca não tenha vindo do Auth primeiro)
  // No caso de listagem normal (sem busca), precisamos carregar os dados do Auth para os links.
  const userIdsToFetch = searchTerm
    ? allAuthUsers.map((u) => u.id)
    : (links || []).map((l) => l.user_id).filter(Boolean);

  const userMap = await buildAuthUserMapForIds(adminClient, userIdsToFetch, allAuthUsers);

  // 5. Carregar Roles e Empresas para o mapeamento final
  const roleIds = Array.from(new Set((links || []).map(l => l.roles_id).filter(Boolean)));
  const empresaIds = Array.from(new Set((links || []).map(l => l.empresas_id).filter(Boolean)));

  const [{ data: rolesData }, { data: empresasData }] = await Promise.all([
    adminClient.from('roles').select('id, roles').in('id', roleIds.length ? roleIds : ['none']),
    adminClient
      .from('empresas')
      .select('id, empresa, nome_fantasia, max_mei')
      .in('id', empresaIds.length ? empresaIds : ['none'])
  ]);

  const roleMap = new Map((rolesData || []).map(r => [r.id, r.roles]));
  const empresaMap = new Map((empresasData || []).map(e => [e.id, e]));

  // 6. Montar lista final
  let resultUsers = (links || [])
    .map((link) => {
      const user = userMap.get(link.user_id);
      if (!user) return null;

      const roleLabel = normalizeRoleValue(roleMap.get(link.roles_id) || (link.isOrphan ? 'N/A' : 'usuario'));
      const empresaRecord = empresaMap.get(link.empresas_id);
      const empresaName = empresaRecord
        ? (empresaRecord.nome_fantasia || empresaRecord.empresa)
        : (link.isOrphan ? 'SEM VÍNCULO' : null);

      if (searchTerm && !matchesUserSearch(user, { empresaName, roleLabel }, searchTerm)) {
        return null;
      }

      return {
        ...user,
        role: roleLabel,
        empresaId: link.empresas_id || null,
        empresaName,
        status: link.status ?? true,
        mei: typeof link.mei === 'boolean' ? link.mei : null,
        expiresAt: link.expires_at ? new Date(link.expires_at).toISOString() : null,
        productLine: deriveUserProductLine(link.mei),
      };
    })
    .filter(Boolean);

  if (isFocoMeiApiDeploy()) {
    const meiEmpresaIds = new Set(
      [...empresaMap.values()]
        .filter((empresa) => isEmpresaMeiModuleActive(empresa.max_mei))
        .map((empresa) => empresa.id),
    );
    resultUsers = resultUsers.filter(
      (user) =>
        isMeiSlotUserLink(user.mei)
        || (user.empresaId && meiEmpresaIds.has(user.empresaId)),
    );
  }

  return { users: resultUsers };
};

export const getViewableUserIds = async (accessToken) => {
  const { role, empresaId } = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(role)) throw forbidden();

  const adminClient = createSupabaseClient({ useServiceRole: true });
  let query = adminClient
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id');

  if (role === 'admin') {
    if (!empresaId) throw forbidden();
    query = query.eq('empresas_id', empresaId);
  }

  const { data, error } = await query;
  if (error) throw badRequest(error.message);

  const userIds = Array.from(
    new Set((data || []).map((link) => link.user_id).filter(Boolean))
  );

  return { role, empresaId, userIds };
};

export const canViewUser = async (accessToken, targetUserId) => {
  if (!targetUserId) throw badRequest('UserId ausente');
  const { userIds } = await getViewableUserIds(accessToken);
  return userIds.includes(targetUserId);
};

export const listEmpresas = async (accessToken) => {
  const { role, empresaId } = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(role)) throw forbidden();

  const adminClient = createSupabaseClient({ useServiceRole: true });
  let query = adminClient
    .from('empresas')
    .select('id, empresa, nome_fantasia, max_mei, max_usuarios_nao_mei, legacy_mei_slots_pix')
    .order('empresa', { ascending: true });

  if (role === 'admin') {
    if (!empresaId) throw forbidden();
    query = query.eq('id', empresaId);
  }

  const { data, error } = await query;
  if (error) throw badRequest(error.message);

  const scopedIds = (data || []).map((empresa) => empresa.id).filter(Boolean);
  const fixedMaxMeiByEmpresa = await syncEmpresasMeiActivation(adminClient, scopedIds);
  let empresas = (data || []).map((empresa) => {
    const fixedMaxMei = fixedMaxMeiByEmpresa.get(empresa.id);
    if (fixedMaxMei === undefined) return empresa;
    return { ...empresa, max_mei: fixedMaxMei };
  });

  if (role === 'superadmin') {
    empresas = await mergeStripeContractedMeiIntoEmpresaLimits(adminClient, empresas);
  }

  if (isFocoMeiApiDeploy()) {
    empresas = empresas.filter((empresa) => isEmpresaMeiModuleActive(empresa.max_mei));
  }

  empresas = empresas.map((empresa) => ({
    ...empresa,
    product_line: deriveEmpresaProductLine(empresa.max_mei),
  }));

  console.log('[Users] listEmpresas role:', role, 'empresaId:', empresaId, 'count:', data?.length || 0);
  return { empresas };
};

export const getEmpresa = async (accessToken) => {
  const { role, empresaId } = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(role)) throw forbidden();
  if (!empresaId) throw badRequest('Empresa nao encontrada para o usuario atual');

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const empresa = await getEmpresaRecordById(adminClient, empresaId);
  return { empresa };
};

export const getEmpresaById = async (accessToken, empresaId) => {
  const normalizedEmpresaId = String(empresaId || '').trim();
  if (!normalizedEmpresaId) throw badRequest('Empresa e obrigatoria');

  const requester = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requester.role)) throw forbidden();
  if (requester.role === 'admin' && requester.empresaId !== normalizedEmpresaId) {
    throw forbidden('Usuário fora do escopo da empresa');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const empresa = await getEmpresaRecordById(adminClient, normalizedEmpresaId);
  return { empresa };
};

export const createEmpresa = async (accessToken, input) => {
  const { role } = await getRequesterContext(accessToken);
  if (role !== 'superadmin') throw forbidden();
  const payload = buildEmpresaPayload(input, { requireName: true });

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await adminClient
    .from('empresas')
    .insert(payload)
    .select(EMPRESA_SELECT_FIELDS)
    .maybeSingle();

  if (error) throw badRequest(error.message || 'Erro ao criar empresa');

  return { empresa: data };
};

export const updateEmpresa = async (accessToken, empresaId, input) => {
  const { role } = await getRequesterContext(accessToken);
  if (role !== 'superadmin') throw forbidden();
  if (!empresaId) throw badRequest('Empresa e obrigatoria');
  const updates = buildEmpresaPayload(input);

  if (Object.keys(updates).length === 0) {
    throw badRequest('Nenhum campo informado para atualizar');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await adminClient
    .from('empresas')
    .update(updates)
    .eq('id', empresaId)
    .select(EMPRESA_SELECT_FIELDS)
    .maybeSingle();

  if (error) throw badRequest(error.message || 'Erro ao atualizar empresa');
  if (!data?.id) throw badRequest('Empresa nao encontrada');

  return { empresa: { ...data, product_line: deriveEmpresaProductLine(data.max_mei) } };
};

export const createUser = async (accessToken, input, deps = {}) => {
  const getRequesterContextFn = deps.getRequesterContextFn || getRequesterContext;
  const createSupabaseClientFn = deps.createSupabaseClientFn || createSupabaseClient;
  const { role: requesterRole, empresaId: requesterEmpresaId } = await getRequesterContextFn(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requesterRole)) throw forbidden();

  const email = input?.email?.trim();
  const password = input?.password?.trim();
  if (password) {
    assertStrongPassword(password);
  }
  const displayName = input?.displayName?.trim() || null;
  const phone = cleanPhone(input?.phone?.trim());
  const requestedRole = input?.role;
  const requestedEmpresaId = input?.empresaId || null;

  if (!email) throw badRequest('Email é obrigatório');

  let finalRole = 'usuario';
  let finalEmpresaId = requesterEmpresaId;

  if (requesterRole === 'admin') {
    if (!requesterEmpresaId) throw forbidden();
    const normalizedRequested = normalizeRoleValue(requestedRole) || ROLE_DEFAULT;
    if (!ROLE_ADMIN_MANAGEABLE.has(normalizedRequested)) {
      throw badRequest('Admin só pode criar perfil usuário ou administrador');
    }
    finalRole = normalizedRequested;
  }

  if (requesterRole === 'superadmin') {
    if (!requestedRole || !ROLE_TARGET_ALLOWED.has(requestedRole)) {
      throw badRequest('Role inválida');
    }
    if (!requestedEmpresaId) throw badRequest('Empresa é obrigatória');
    finalRole = requestedRole;
    finalEmpresaId = requestedEmpresaId;
  }

  const adminClient = createSupabaseClientFn({ useServiceRole: true });

  const targetMei = resolveMeiValue(input?.mei, false);
  await ensureEmpresaCapacity(adminClient, { empresaId: finalEmpresaId, mei: targetMei });

  const { roleId, role: resolvedRole } = await ensureRoleId(adminClient, finalRole);
  if (!roleId) throw badRequest('Role não encontrada');
  if (resolvedRole && resolvedRole !== finalRole) {
    finalRole = resolvedRole;
  }

  const finalPassword = password || generateStrongRandomPassword();
  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      phone: phone || null
    }
  });

  if (createError || !createdUser?.user) {
    throw badRequest(createError?.message || 'Erro ao criar usuário');
  }

  const expiresAtInsert =
    finalRole === 'usuario' && input?.expiresAt
      ? new Date(input.expiresAt).toISOString()
      : null;
  const { error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .insert({
      user_id: createdUser.user.id,
      roles_id: roleId,
      empresas_id: finalEmpresaId,
      status: true,
      mei: targetMei,
      ...(expiresAtInsert ? { expires_at: expiresAtInsert } : {})
    });

  if (linkError) throw badRequest(linkError.message);

  if (phone) {
    await assignN8nPhoneToUser(adminClient, createdUser.user.id, phone);
  }

  return {
    userId: createdUser.user.id,
    email: createdUser.user.email,
    role: finalRole,
    empresaId: finalEmpresaId,
    generatedPassword: password ? null : finalPassword
  };
};

export const updateUser = async (accessToken, userId, input) => {
  if (!userId) throw badRequest('userId é obrigatório');

  const requester = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requester.role)) throw forbidden();

  const isSelfUpdate = requester.userId === userId;

  const requestedRole = normalizeRoleValue(input?.role);
  const requestedEmpresaId = input?.empresaId || null;
  const requestedDisplayName = input?.displayName?.trim();
  const requestedPhone = cleanPhone(input?.phone?.trim());
  const requestedEmail = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : undefined;
  if (requestedEmail !== undefined && requestedEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
    throw badRequest('E-mail inválido');
  }
  const requestedMei = typeof input?.mei === 'boolean' ? input.mei : undefined;
  const requestedExpiresAt =
    input?.expiresAt === undefined
      ? undefined
      : input.expiresAt
        ? new Date(input.expiresAt).toISOString()
        : null;

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData, error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .select('id, empresas_id, roles_id, mei')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) throw badRequest(linkError.message);
  const currentEmpresaId = linkData?.empresas_id || null;
  const currentMeiSlot = isMeiSlotActive(linkData?.mei);
  let targetMeiSlot =
    requestedMei !== undefined ? requestedMei : currentMeiSlot;
  let targetEmpresaId = currentEmpresaId;
  let capacityChecked = false;
  let linkRecord = linkData;
  if (!linkRecord?.roles_id) {
    if (requester.role !== 'superadmin') {
      throw badRequest('Vínculo de role não encontrado');
    }

    if (!requestedEmpresaId) {
      throw badRequest('Empresa é obrigatória');
    }

    const roleForLink = requestedRole || 'usuario';
    if (!ROLE_UPDATE_ALLOWED_SUPERADMIN.has(roleForLink)) {
      throw badRequest('Role inválida');
    }

    const { roleId, role: resolvedRole } = await ensureRoleId(adminClient, roleForLink);
    if (!roleId) throw badRequest('Role não encontrada');
    if (resolvedRole && resolvedRole !== roleForLink) {
      console.warn('[Users] updateUser role fallback:', {
        requestedRole: roleForLink,
        resolvedRole
      });
    }

    const { data: existingLink, error: existingLinkError } = await adminClient
      .from('role_x_user_x_empresa')
      .select('id, empresas_id, roles_id, mei')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLinkError) throw badRequest(existingLinkError.message);

    targetEmpresaId = requestedEmpresaId;
    const fallbackMeiSlot = isMeiSlotActive(existingLink?.mei);
    targetMeiSlot = requestedMei !== undefined ? requestedMei : fallbackMeiSlot;

    await ensureEmpresaCapacity(adminClient, {
      empresaId: targetEmpresaId,
      mei: targetMeiSlot,
      ignoreUserId: userId
    });
    capacityChecked = true;

    if (existingLink?.id) {
    const { data: updatedLink, error: updateLinkError } = await adminClient
      .from('role_x_user_x_empresa')
      .update({
        roles_id: roleId,
        empresas_id: requestedEmpresaId,
        status: true,
        ...(requestedMei !== undefined ? { mei: requestedMei } : {})
      })
        .eq('id', existingLink.id)
        .select('id, empresas_id, roles_id')
        .maybeSingle();

      if (updateLinkError) throw badRequest(updateLinkError.message);
      linkRecord = updatedLink;
    } else {
    const { data: createdLink, error: createLinkError } = await adminClient
      .from('role_x_user_x_empresa')
      .insert({
        user_id: userId,
        roles_id: roleId,
        empresas_id: requestedEmpresaId,
        status: true,
        mei: targetMeiSlot
      })
        .select('id, empresas_id, roles_id')
        .maybeSingle();

      if (createLinkError) throw badRequest(createLinkError.message);

      linkRecord = createdLink;
    }
  }

  const { data: roleData, error: roleError } = await adminClient
    .from('roles')
    .select('roles')
    .eq('id', linkRecord.roles_id)
    .maybeSingle();

  if (roleError) throw badRequest(roleError.message);
  const targetRole = normalizeRoleValue(roleData?.roles) || 'usuario';

  if (isSelfUpdate && requestedRole && requestedRole !== targetRole) {
    throw badRequest('Não é possível alterar o seu próprio perfil de acesso.');
  }
  if (
    isSelfUpdate
    && requestedEmpresaId
    && requestedEmpresaId !== linkRecord.empresas_id
  ) {
    throw badRequest('Não é possível alterar a sua própria empresa por aqui.');
  }

  if (requester.role === 'admin') {
    if (!requester.empresaId || requester.empresaId !== linkRecord.empresas_id) throw forbidden();
    if (!ROLE_ADMIN_MANAGEABLE.has(targetRole)) throw forbidden();
    if (requestedRole && !ROLE_ADMIN_MANAGEABLE.has(requestedRole)) throw forbidden();
  }

  if (requester.role === 'superadmin') {
    if (!isSelfUpdate && !ROLE_UPDATE_ALLOWED_SUPERADMIN.has(targetRole)) throw forbidden();
    if (
      !isSelfUpdate
      && requestedRole
      && !ROLE_UPDATE_ALLOWED_SUPERADMIN.has(requestedRole)
    ) {
      throw badRequest('Role inválida');
    }
  }

  let finalRole = requestedRole || targetRole;
  let finalEmpresaId = linkRecord.empresas_id;

  if (requester.role === 'superadmin') {
    if (!isSelfUpdate) {
      if (!requestedEmpresaId) throw badRequest('Empresa é obrigatória');
      finalEmpresaId = requestedEmpresaId;
    }
  }

  targetEmpresaId = finalEmpresaId;

  if (!capacityChecked) {
    const isSelfMeiRemoval = isSelfUpdate && requestedMei === false && currentMeiSlot;
    const shouldCheckCapacity =
      !isSelfMeiRemoval
      && (targetEmpresaId !== currentEmpresaId || targetMeiSlot !== currentMeiSlot);
    if (shouldCheckCapacity) {
      await ensureEmpresaCapacity(adminClient, {
        empresaId: targetEmpresaId,
        mei: targetMeiSlot,
        ignoreUserId: userId
      });
    }
  }

  console.log('[Users] updateUser', {
    requesterRole: requester.role,
    targetRole,
    requestedRole,
    requestedEmpresaId,
    finalRole,
    finalEmpresaId,
    requestedDisplayName,
    requestedPhone
  });

  const { roleId, role: resolvedRole } = await ensureRoleId(adminClient, finalRole);
  if (!roleId) throw badRequest('Role não encontrada');
  if (resolvedRole && resolvedRole !== finalRole) {
    finalRole = resolvedRole;
  }

  const updatePayload = {
    roles_id: roleId,
    empresas_id: finalEmpresaId,
    ...(requestedMei !== undefined ? { mei: requestedMei } : {})
  };
  if (targetRole === 'usuario' && requestedExpiresAt !== undefined) {
    updatePayload.expires_at = requestedExpiresAt;
  }
  if (finalRole !== 'usuario') {
    updatePayload.expires_at = null;
  }
  const { error: updateError } = await adminClient
    .from('role_x_user_x_empresa')
    .update(updatePayload)
    .eq('id', linkRecord.id);

  if (updateError) throw badRequest(updateError.message);

  if (requestedDisplayName || requestedPhone) {
    const metadata = {};
    if (requestedDisplayName) {
      metadata.display_name = requestedDisplayName;
      metadata.name = requestedDisplayName;
      metadata.full_name = requestedDisplayName;
    }
    if (requestedPhone) metadata.phone = requestedPhone;
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: metadata
    });
    if (updateUserError) {
      console.warn('[Users] updateUser metadata error:', updateUserError.message);
      throw badRequest(updateUserError.message);
    }
  }

  if (requestedEmail) {
    const { data: currentAuthUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError) {
      console.warn('[Users] updateUser getUserById error:', getUserError.message);
      throw badRequest(getUserError.message);
    }
    const currentEmail = currentAuthUser?.user?.email?.trim().toLowerCase() || '';
    if (currentEmail !== requestedEmail) {
      // Sem email_confirm → Supabase envia link de confirmação para o novo endereço.
      const { error: updateEmailError } = await adminClient.auth.admin.updateUserById(userId, {
        email: requestedEmail
      });
      if (updateEmailError) {
        console.warn('[Users] updateUser email error:', updateEmailError.message);
        throw badRequest(updateEmailError.message);
      }
    }
  }

  if (requestedPhone) {
    await assignN8nPhoneToUser(adminClient, userId, requestedPhone);
  }

  if (requestedDisplayName) {
    await adminClient
      .from('profiles')
      .upsert(
        { id: userId, display_name: requestedDisplayName },
        { onConflict: 'id' }
      );
  }

  return {
    userId,
    role: finalRole,
    empresaId: finalEmpresaId
  };
};

export const banUser = async (accessToken, userId, status = false) => {
  if (!userId) throw badRequest('userId é obrigatório');

  const requester = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requester.role)) throw forbidden();
  if (requester.userId === userId) {
    throw badRequest('Não é possível bloquear a sua própria conta por aqui.');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData, error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .select('id, empresas_id, roles_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) throw badRequest(linkError.message);
  if (!linkData?.roles_id) throw badRequest('Vínculo de role não encontrado');

  const { data: roleData, error: roleError } = await adminClient
    .from('roles')
    .select('roles')
    .eq('id', linkData.roles_id)
    .maybeSingle();

  if (roleError) throw badRequest(roleError.message);
  const targetRole = normalizeRoleValue(roleData?.roles) || 'usuario';

  if (requester.role === 'admin') {
    if (targetRole !== 'usuario') throw forbidden();
    if (!requester.empresaId || requester.empresaId !== linkData.empresas_id) throw forbidden();
  }

  if (requester.role === 'superadmin') {
    if (!ROLE_UPDATE_ALLOWED_SUPERADMIN.has(targetRole)) throw forbidden();
  }

  const { error: banError } = await adminClient
    .from('role_x_user_x_empresa')
    .update({ status })
    .eq('id', linkData.id);
  if (banError) throw badRequest(banError.message);

  return { userId, status };
};

const USER_DATA_TABLES_BY_USER_ID = [
  'lancamentos_id',
  'categorias_id',
  'n8n_link',
  'google_tokens_id',
  'role_x_user_x_empresa',
  'contas_financeiras',
  'user_mei_certificates',
];

/** Remove dados do utilizador nas tabelas da app (não remove auth.users). */
export const purgeUserData = async (adminClient, userId) => {
  if (!userId) throw badRequest('userId é obrigatório');

  for (const table of USER_DATA_TABLES_BY_USER_ID) {
    const { error } = await adminClient.from(table).delete().eq('user_id', userId);
    if (error && error.code !== '42P01') {
      throw badRequest(`Erro ao limpar ${table}: ${error.message}`);
    }
  }

  const { error: profileError } = await adminClient.from('profiles').delete().eq('id', userId);
  if (profileError && profileError.code !== '42P01') {
    throw badRequest(`Erro ao limpar profiles: ${profileError.message}`);
  }
};

export const deleteUser = async (accessToken, userId) => {
  if (!userId) throw badRequest('userId é obrigatório');

  const requester = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requester.role)) throw forbidden();
  if (requester.userId === userId) {
    throw badRequest('Não é possível excluir a sua própria conta por aqui.');
  }

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData, error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .select('empresas_id, roles_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) throw badRequest(linkError.message);

  const isOrphanAccount = !linkData?.roles_id;

  if (isOrphanAccount) {
    if (requester.role !== 'superadmin') {
      throw badRequest(
        'Esta conta não tem vínculo com empresa (órfã). Apenas superadmin pode excluí-la do sistema.',
        { code: 'USER_ORPHAN_DELETE_FORBIDDEN' },
      );
    }
  } else {
    const { data: roleData, error: roleError } = await adminClient
      .from('roles')
      .select('roles')
      .eq('id', linkData.roles_id)
      .maybeSingle();

    if (roleError) throw badRequest(roleError.message);
    const targetRole = normalizeRoleValue(roleData?.roles) || 'usuario';

    if (requester.role === 'admin') {
      if (targetRole !== 'usuario') throw forbidden();
      if (!requester.empresaId || requester.empresaId !== linkData.empresas_id) throw forbidden();
    }

    if (requester.role === 'superadmin') {
      if (!ROLE_UPDATE_ALLOWED_SUPERADMIN.has(targetRole)) throw forbidden();
    }
  }

  await purgeUserData(adminClient, userId);

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) throw badRequest(deleteAuthError.message);

  return { userId, orphan: isOrphanAccount };
};

export const deleteEmpresa = async (accessToken, empresaId) => {
  if (!empresaId) throw badRequest('empresaId é obrigatório');

  const requester = await getRequesterContext(accessToken);
  if (requester.role !== 'superadmin') throw forbidden();

  const adminClient = createSupabaseClient({ useServiceRole: true });

  // 1. Remover todos os vínculos de usuários com esta empresa
  const { error: linksError } = await adminClient
    .from('role_x_user_x_empresa')
    .delete()
    .eq('empresas_id', empresaId);
  
  if (linksError) throw badRequest(`Erro ao remover vínculos: ${linksError.message}`);

  // 2. Remover a empresa propriamente dita
  const { error: empresaError } = await adminClient
    .from('empresas')
    .delete()
    .eq('id', empresaId);

  if (empresaError) throw badRequest(`Erro ao remover empresa: ${empresaError.message}`);

  return { empresaId };
};

/** Autorização alinhada a `resetUserPassword` / envio de e-mail de recuperação. */
const getPasswordResetAuthorization = async (accessToken, userId) => {
  if (!userId) throw badRequest('userId é obrigatório');

  const requester = await getRequesterContext(accessToken);
  if (!ROLE_CREATE_ALLOWED.has(requester.role)) throw forbidden();

  const adminClient = createSupabaseClient({ useServiceRole: true });
  const { data: linkData, error: linkError } = await adminClient
    .from('role_x_user_x_empresa')
    .select('empresas_id, roles_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) throw badRequest(linkError.message);
  if (!linkData?.roles_id) throw badRequest('Vínculo de role não encontrado');

  const { data: roleData, error: roleError } = await adminClient
    .from('roles')
    .select('roles')
    .eq('id', linkData.roles_id)
    .maybeSingle();

  if (roleError) throw badRequest(roleError.message);
  const targetRole = normalizeRoleValue(roleData?.roles) || 'usuario';

  if (requester.role === 'admin') {
    if (targetRole !== 'usuario') throw forbidden();
    if (!requester.empresaId || requester.empresaId !== linkData.empresas_id) throw forbidden();
  }

  if (requester.role === 'superadmin') {
    if (!ROLE_UPDATE_ALLOWED_SUPERADMIN.has(targetRole)) throw forbidden();
  }

  return { adminClient };
};

export const resetUserPassword = async (accessToken, userId, input) => {
  const { adminClient } = await getPasswordResetAuthorization(accessToken, userId);

  const trimmedProvided = input?.password?.trim();
  if (trimmedProvided) {
    assertStrongPassword(trimmedProvided);
  }
  const newPassword = trimmedProvided || generateStrongRandomPassword();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (updateError) throw badRequest(updateError.message);
  return { userId, password: newPassword };
};

export const sendUserPasswordResetEmail = async (accessToken, userId) => {
  const { adminClient } = await getPasswordResetAuthorization(accessToken, userId);

  const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
  if (getUserError) throw badRequest(getUserError.message);

  const email = userData?.user?.email?.trim();
  if (!email) throw badRequest('Usuário sem e-mail cadastrado');

  await authService.resetPasswordForEmail(email);
  return { userId, sent: true };
};

export const syncPhone = async (userId, phone) => {
  if (!phone) throw badRequest('Telefone é obrigatório');
  const cleanedPhone = cleanPhone(phone);

  const dbClient = createSupabaseClient({ useServiceRole: true });
  await assignN8nPhoneToUser(dbClient, userId, cleanedPhone);

  return { success: true, phone: cleanedPhone };
};

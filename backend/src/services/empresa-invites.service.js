import crypto from 'crypto';
import { createSupabaseClient as createSupabaseClientReal } from '../config/supabase.js';
import { env } from '../config/env.js';
import {
  assertUserEligibleForEmpresaInvite,
  ensureEmpresaCapacity,
  ensureRoleId,
  getRequesterContext
} from './users.service.js';
import { badRequest, forbidden, notFound, unauthorized } from '../utils/errors.js';
import { isLocalAuthMode, verifyLocalAccessToken } from './local-auth.service.js';
import { query } from '../config/pg.js';

/** @type {typeof createSupabaseClientReal} */
let createClient = createSupabaseClientReal;

/** @param {typeof createSupabaseClientReal | null} fn */
export const __setCreateSupabaseClientForInvitesTests = (fn) => {
  createClient = fn || createSupabaseClientReal;
};

/** @type {typeof getRequesterContext} */
let resolveRequesterContext = getRequesterContext;

/** @param {typeof getRequesterContext | null} fn */
export const __setGetRequesterContextForInvitesTests = (fn) => {
  resolveRequesterContext = fn || getRequesterContext;
};

const defaultResolveUserIdFromAccessToken = async (accessToken) => {
  if (!accessToken) throw unauthorized();
  if (isLocalAuthMode()) {
    const localUser = verifyLocalAccessToken(accessToken);
    if (!localUser?.id) throw unauthorized();
    return localUser.id;
  }
  const c = createSupabaseClientReal({ accessToken });
  const { data: { user } = {}, error } = await c.auth.getUser();
  if (error || !user?.id) throw unauthorized();
  return user.id;
};

/** @type {typeof defaultResolveUserIdFromAccessToken} */
let resolveUserIdFromAccessToken = defaultResolveUserIdFromAccessToken;

/** @param {typeof defaultResolveUserIdFromAccessToken | null} fn */
export const __setResolveUserIdFromAccessTokenForInvitesTests = (fn) => {
  resolveUserIdFromAccessToken = fn || defaultResolveUserIdFromAccessToken;
};

const DEFAULT_TTL_DAYS = 7;
const INVITE_TOKEN_MIN_LENGTH = 10;
const SELECT_PUBLIC_ROW = 'id, expires_at, used_at, revoked_at, is_reusable';
const SELECT_LIST_ROW = 'id, empresas_id, created_at, expires_at, created_by, invited_email, is_reusable, uses_count, raw_token';

export const hashInviteToken = (rawToken) => (
  crypto.createHash('sha256').update(String(rawToken).trim(), 'utf8').digest('hex')
);

export const generateInviteSecret = () => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashInviteToken(rawToken);
  return { rawToken, tokenHash };
};

/**
 * Base pública para montar URL de convite: env `INVITE_APP_BASE_URL`, depois `FRONTEND_URL`,
 * depois `Origin`, fallback dev.
 * @param {import('express').Request | undefined} req
 */
export const resolveInviteAppBaseUrl = (req) => {
  if (env.INVITE_APP_BASE_URL) return env.INVITE_APP_BASE_URL.replace(/\/$/, '');
  if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/$/, '');
  const origin = req?.headers?.origin;
  if (origin && typeof origin === 'string') {
    try {
      return new URL(origin).origin;
    } catch {
      /* ignore */
    }
  }
  return 'http://localhost:3000';
};

const ensureAdminOrSuperadmin = (role) => {
  if (role === 'admin' || role === 'superadmin') return;
  throw forbidden();
};

/**
 * @param {string} accessToken
 * @param {{ empresas_id?: string, invited_email?: string | null }} body
 * @param {import('express').Request | undefined} req
 */
export const createInvite = async (accessToken, body = {}, req) => {
  const ctx = await resolveRequesterContext(accessToken);
  ensureAdminOrSuperadmin(ctx.role);

  let empresaId;
  if (ctx.role === 'admin') {
    if (body?.empresas_id != null && String(body.empresas_id).trim() !== '') {
      throw badRequest('Administradores não podem informar empresas_id no corpo da requisição');
    }
    if (!ctx.empresaId) throw forbidden();
    empresaId = ctx.empresaId;
  } else {
    empresaId = body?.empresas_id;
    if (!empresaId || String(empresaId).trim() === '') {
      throw badRequest('empresas_id é obrigatório para superadmin');
    }
  }

  const invitedEmail = body?.invited_email != null && String(body.invited_email).trim() !== ''
    ? String(body.invited_email).trim()
    : null;
  const isReusable = !!body?.is_reusable;
  const { rawToken, tokenHash } = generateInviteSecret();
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_TTL_DAYS);

  if (isLocalAuthMode()) {
    const { rows: empRows } = await query(
      `SELECT id FROM public.empresas WHERE id = $1 LIMIT 1`,
      [empresaId],
    );
    if (!empRows[0]) throw badRequest('Empresa não encontrada');

    const { rows } = await query(
      `INSERT INTO public.empresa_invites
         (empresas_id, token_hash, created_by, expires_at, invited_email, is_reusable, uses_count, raw_token)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
       RETURNING id, empresas_id, expires_at, created_at, invited_email, is_reusable, uses_count, raw_token`,
      [
        empresaId,
        tokenHash,
        ctx.userId,
        expiresAt.toISOString(),
        invitedEmail,
        isReusable,
        isReusable ? rawToken : null,
      ],
    );
    const row = rows[0];
    if (!row?.id) throw badRequest('Falha ao criar convite');
    const base = resolveInviteAppBaseUrl(req);
    const inviteUrl = `${base}/register?convite=${encodeURIComponent(rawToken)}`;
    return { inviteUrl, invite: row };
  }

  const admin = createClient({ useServiceRole: true });

  const { data: emp, error: empErr } = await admin
    .from('empresas')
    .select('id')
    .eq('id', empresaId)
    .maybeSingle();
  if (empErr) throw badRequest(empErr.message);
  if (!emp?.id) throw badRequest('Empresa não encontrada');

  const { data: row, error: insErr } = await admin
    .from('empresa_invites')
    .insert({
      empresas_id: empresaId,
      token_hash: tokenHash,
      created_by: ctx.userId,
      expires_at: expiresAt.toISOString(),
      invited_email: invitedEmail,
      is_reusable: isReusable,
      uses_count: 0,
      raw_token: isReusable ? rawToken : null
    })
    .select('id, empresas_id, expires_at, created_at, invited_email, is_reusable, uses_count, raw_token')
    .maybeSingle();

  if (insErr) throw badRequest(insErr.message);
  if (!row?.id) throw badRequest('Falha ao criar convite');

  const base = resolveInviteAppBaseUrl(req);
  const inviteUrl = `${base}/register?convite=${encodeURIComponent(rawToken)}`;

  return { inviteUrl, invite: row };
};

/**
 * @param {string} accessToken
 * @param {{ empresas_id?: string }} query
 */
export const listPendingInvites = async (accessToken, queryParams = {}) => {
  const ctx = await resolveRequesterContext(accessToken);
  ensureAdminOrSuperadmin(ctx.role);

  if (isLocalAuthMode()) {
    const params = [];
    const clauses = [
      'used_at IS NULL',
      'revoked_at IS NULL',
      'expires_at > now()',
    ];
    if (ctx.role === 'admin') {
      if (!ctx.empresaId) throw forbidden();
      params.push(ctx.empresaId);
      clauses.push(`empresas_id = $${params.length}`);
    } else if (queryParams?.empresas_id) {
      params.push(queryParams.empresas_id);
      clauses.push(`empresas_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT id, empresas_id, created_at, expires_at, created_by, invited_email,
              is_reusable, uses_count, raw_token
       FROM public.empresa_invites
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    );
    return { invites: rows || [] };
  }

  const admin = createClient({ useServiceRole: true });
  const nowIso = new Date().toISOString();

  let q = admin
    .from('empresa_invites')
    .select(SELECT_LIST_ROW)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false });

  if (ctx.role === 'admin') {
    if (!ctx.empresaId) throw forbidden();
    q = q.eq('empresas_id', ctx.empresaId);
  } else if (queryParams?.empresas_id) {
    q = q.eq('empresas_id', queryParams.empresas_id);
  }

  const { data, error } = await q;
  if (error) throw badRequest(error.message);
  return { invites: data || [] };
};

/**
 * @param {string} accessToken
 * @param {string} inviteId
 */
export const revokeInvite = async (accessToken, inviteId) => {
  const ctx = await resolveRequesterContext(accessToken);
  ensureAdminOrSuperadmin(ctx.role);

  if (!inviteId || String(inviteId).trim() === '') throw badRequest('Convite inválido');

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT id, empresas_id, used_at, revoked_at
       FROM public.empresa_invites
       WHERE id = $1
       LIMIT 1`,
      [inviteId],
    );
    const row = rows[0];
    if (!row?.id) throw notFound('Convite não encontrado');
    if (ctx.role === 'admin') {
      if (!ctx.empresaId || row.empresas_id !== ctx.empresaId) throw forbidden();
    }
    if (row.used_at) throw badRequest('Convite já utilizado');
    if (row.revoked_at) throw badRequest('Convite já revogado');
    const revokedAt = new Date().toISOString();
    await query(
      `UPDATE public.empresa_invites SET revoked_at = $1 WHERE id = $2`,
      [revokedAt, inviteId],
    );
    return { id: inviteId, revoked_at: revokedAt };
  }

  const admin = createClient({ useServiceRole: true });
  const { data: row, error: fetchErr } = await admin
    .from('empresa_invites')
    .select('id, empresas_id, used_at, revoked_at')
    .eq('id', inviteId)
    .maybeSingle();

  if (fetchErr) throw badRequest(fetchErr.message);
  if (!row?.id) throw notFound('Convite não encontrado');

  if (ctx.role === 'admin') {
    if (!ctx.empresaId || row.empresas_id !== ctx.empresaId) throw forbidden();
  }

  if (row.used_at) throw badRequest('Convite já utilizado');
  if (row.revoked_at) throw badRequest('Convite já revogado');

  const revokedAt = new Date().toISOString();
  const { error: upErr } = await admin
    .from('empresa_invites')
    .update({ revoked_at: revokedAt })
    .eq('id', inviteId);

  if (upErr) throw badRequest(upErr.message);
  return { id: inviteId, revoked_at: revokedAt };
};

/**
 * Validação pública — não autenticada. Não vaza PII além do estritamente necessário (FR-05).
 * @param {string | undefined} rawToken
 */
export const validateInviteToken = async (rawToken) => {
  if (rawToken == null || typeof rawToken !== 'string' || rawToken.trim().length < INVITE_TOKEN_MIN_LENGTH) {
    return { status: 'invalid' };
  }

  const tokenHash = hashInviteToken(rawToken);
  const admin = createClient({ useServiceRole: true });
  const { data, error } = await admin
    .from('empresa_invites')
    .select(`
      id, expires_at, used_at, revoked_at, is_reusable,
      empresas ( empresa )
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data?.id) return { status: 'invalid' };

  if (data.revoked_at) return { status: 'revoked' };
  
  // Se for reutilizável, ignoramos used_at
  if (!data.is_reusable && data.used_at) return { status: 'used' };
  
  if (new Date(data.expires_at) <= new Date()) return { status: 'expired' };
  
  return { 
    status: 'valid',
    empresaName: data.empresas?.empresa || null
  };
};

const SELECT_INVITE_FOR_ACCEPT = 'id, empresas_id, expires_at, used_at, revoked_at';

/**
 * Pós-cadastro (US-INV-03): com JWT da sessão recém-criada, consome um convite válido
 * (marca `used_at` uma vez), cria vínculo `role_x_user_x_empresa` como **usuario** e
 * alinha `profiles.role` para **usuario** (upsert). Falhas após o claim revertem vínculo e `used_at`.
 *
 * @param {string} accessToken
 * @param {string | undefined} rawToken
 * @param {{ ensureEmpresaCapacity?: typeof ensureEmpresaCapacity, mei?: boolean }} [deps]
 */
export const acceptInvite = async (accessToken, rawToken, deps = {}) => {
  const ensureCap = deps.ensureEmpresaCapacity ?? ensureEmpresaCapacity;
  const targetMei = typeof deps.mei === 'boolean' ? deps.mei : false;

  if (rawToken == null || typeof rawToken !== 'string' || rawToken.trim().length < INVITE_TOKEN_MIN_LENGTH) {
    throw badRequest('Convite inválido');
  }

  const userId = await resolveUserIdFromAccessToken(accessToken);
  const admin = createClient({ useServiceRole: true });
  await assertUserEligibleForEmpresaInvite(admin, userId);

  const tokenHash = hashInviteToken(rawToken);
  const { data: inviteRow, error: fetchErr } = await admin
    .from('empresa_invites')
    .select(SELECT_INVITE_FOR_ACCEPT)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (fetchErr) throw badRequest(fetchErr.message);
  if (!inviteRow?.id) throw badRequest('Convite inválido');
  if (inviteRow.revoked_at) throw badRequest('Convite revogado');
  if (inviteRow.used_at) throw badRequest('Convite já utilizado');
  if (new Date(inviteRow.expires_at) <= new Date()) throw badRequest('Convite expirado');

  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from('empresa_invites')
    .update({ used_at: nowIso })
    .eq('id', inviteRow.id)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id, empresas_id')
    .maybeSingle();

  if (claimErr) throw badRequest(claimErr.message);
  if (!claimed?.id) throw badRequest('Convite indisponível ou já utilizado');

  const releaseInvite = async () => {
    const { error: revErr } = await admin
      .from('empresa_invites')
      .update({ used_at: null })
      .eq('id', claimed.id);
    if (revErr) {
      // eslint-disable-next-line no-console
      console.error('[empresa-invites] acceptInvite: falha ao reverter used_at', {
        inviteId: claimed.id,
        message: revErr.message
      });
    }
  };

  let insertedLinkId = null;
  try {
    await ensureCap(admin, {
      empresaId: claimed.empresas_id,
      mei: targetMei,
      ignoreUserId: userId
    });

    const { roleId } = await ensureRoleId(admin, 'usuario');
    if (!roleId) throw badRequest('Role não encontrada');

    // Tentar encontrar um vínculo existente (ex: criado no signup sem empresa)
    const { data: existingLink } = await admin
      .from('role_x_user_x_empresa')
      .select('id')
      .eq('user_id', userId)
      .is('empresas_id', null)
      .eq('status', true)
      .maybeSingle();

    let linkRow;
    if (existingLink?.id) {
      const { data: updated, error: upErr } = await admin
        .from('role_x_user_x_empresa')
        .update({
          roles_id: roleId,
          empresas_id: claimed.empresas_id,
          status: true,
          mei: targetMei
        })
        .eq('id', existingLink.id)
        .select('id')
        .maybeSingle();
      
      if (upErr) throw badRequest(upErr.message);
      linkRow = updated;
    } else {
      const { data: inserted, error: linkErr } = await admin
        .from('role_x_user_x_empresa')
        .insert({
          user_id: userId,
          roles_id: roleId,
          empresas_id: claimed.empresas_id,
          status: true,
          mei: targetMei
        })
        .select('id')
        .maybeSingle();

      if (linkErr) throw badRequest(linkErr.message);
      linkRow = inserted;
    }

    if (!linkRow?.id) throw badRequest('Falha ao vincular usuário à empresa');
    insertedLinkId = linkRow.id;

    const { error: profileErr } = await admin
      .from('profiles')
      .upsert({ id: userId, role: 'usuario' }, { onConflict: 'id' });

    if (profileErr) throw badRequest(profileErr.message);

    return {
      inviteId: claimed.id,
      empresaId: claimed.empresas_id,
      linkId: linkRow.id
    };
  } catch (err) {
    if (insertedLinkId) {
      const { error: delErr } = await admin
        .from('role_x_user_x_empresa')
        .delete()
        .eq('id', insertedLinkId);
      if (delErr) {
        // eslint-disable-next-line no-console
        console.error('[empresa-invites] acceptInvite: falha ao remover vínculo após erro', {
          linkId: insertedLinkId,
          message: delErr.message
        });
      }
    }
    await releaseInvite();
    throw err;
  }
};

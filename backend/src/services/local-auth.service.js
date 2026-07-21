import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { query } from '../config/pg.js';
import { env } from '../config/env.js';
import { badRequest, unauthorized, forbidden } from '../utils/errors.js';
import { assertStrongPassword } from '../utils/passwordPolicy.js';

const ROLE_DEFAULT = 'usuario';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 dias

const bufferToBase64Url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlToBuffer = (input) => {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

export const isLocalAuthMode = () =>
  String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const resolveJwtSecret = () => {
  const secret = String(
    env.AUTH_JWT_SECRET || env.JWT_SECRET || env.SUPABASE_JWT_SECRET || '',
  ).trim();
  if (!secret) {
    throw new Error(
      'AUTH_JWT_SECRET (ou JWT_SECRET) obrigatório com AUTH_MODE=local',
    );
  }
  return secret;
};

/**
 * @param {string} password
 * @returns {string}
 */
export const hashPassword = (password) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
};

/**
 * @param {string} password
 * @param {string} stored
 * @returns {boolean}
 */
export const verifyPassword = (password, stored) => {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};

/**
 * @param {Record<string, unknown>} payload
 * @param {number} [expiresInSec]
 */
export const signLocalAccessToken = (payload, expiresInSec = TOKEN_TTL_SEC) => {
  const secret = resolveJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iss: 'focosimples-local',
    iat: now,
    exp: now + expiresInSec,
  };
  const headerB64 = bufferToBase64Url(JSON.stringify(header));
  const payloadB64 = bufferToBase64Url(JSON.stringify(body));
  const sig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  return `${headerB64}.${payloadB64}.${bufferToBase64Url(sig)}`;
};

/**
 * @param {string} token
 * @returns {{ id: string, email: string|null, role: string, app_metadata: object, user_metadata: object }|null}
 */
export const verifyLocalAccessToken = (token) => {
  const secret = String(
    env.AUTH_JWT_SECRET || env.JWT_SECRET || env.SUPABASE_JWT_SECRET || '',
  ).trim();
  if (!token || !secret) return null;

  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header?.alg && header.alg !== 'HS256') return null;

  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64UrlToBuffer(signatureB64);
  if (
    expectedSig.length !== actualSig.length
    || !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (!payload.sub) return null;
  if (payload.iss && payload.iss !== 'focosimples-local') return null;

  return {
    id: payload.sub,
    email: payload.email || null,
    role: payload.role || 'authenticated',
    app_metadata: payload.app_metadata || {},
    user_metadata: payload.user_metadata || {},
  };
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const buildSession = (userRow, accessToken, expiresIn = TOKEN_TTL_SEC) => {
  const meta = userRow.raw_user_meta_data || {};
  const user = {
    id: userRow.id,
    email: userRow.email,
    phone: userRow.phone || meta.phone || null,
    user_metadata: {
      phone: userRow.phone || meta.phone || null,
      display_name: meta.display_name || null,
      ...meta,
    },
    app_metadata: { provider: 'email', providers: ['email'] },
  };
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: null,
    user,
  };
};

const getProfileRole = async (userId) => {
  const { rows } = await query(
    'SELECT role FROM public.profiles WHERE id = $1 LIMIT 1',
    [userId],
  );
  return rows[0]?.role || ROLE_DEFAULT;
};

/**
 * Contexto do requester no AUTH_MODE=local (Postgres), sem cliente Supabase.
 * @param {{ id: string }} user
 */
export const resolveLocalRequesterContext = async (user) => {
  if (!user?.id) throw unauthorized();
  await ensureUserNotBlocked(user.id);
  const { role, empresaId, mei } = await getRoleAndCompany(user.id);
  return {
    userId: user.id,
    role: role || ROLE_DEFAULT,
    empresaId: empresaId || null,
    mei: mei === true,
  };
};

const getRoleAndCompany = async (userId) => {
  const profileRole = await getProfileRole(userId);

  // Cargo global (ex.: superadmin) manda sobre o papel na empresa
  if (profileRole === 'superadmin') {
    const { rows: linkRows } = await query(
      `SELECT empresas_id, mei
       FROM public.role_x_user_x_empresa
       WHERE user_id = $1 AND status = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    const link = linkRows[0];
    return {
      role: 'superadmin',
      empresaId: link?.empresas_id || null,
      mei: typeof link?.mei === 'boolean' ? link.mei : false,
    };
  }

  const { rows: linkRows } = await query(
    `SELECT empresas_id, roles_id, mei
     FROM public.role_x_user_x_empresa
     WHERE user_id = $1 AND status = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const link = linkRows[0];
  if (!link?.roles_id) {
    return {
      role: profileRole,
      empresaId: null,
      mei: false,
    };
  }

  const { rows: roleRows } = await query(
    'SELECT roles FROM public.roles WHERE id = $1 LIMIT 1',
    [link.roles_id],
  );
  const roleName = String(roleRows[0]?.roles || '')
    .trim()
    .toLowerCase();
  const normalized =
    roleName === 'user' ? 'usuario' : roleName || profileRole || ROLE_DEFAULT;

  return {
    role: normalized,
    empresaId: link.empresas_id || null,
    mei: typeof link.mei === 'boolean' ? link.mei : false,
  };
};

const ensureUserNotBlocked = async (userId) => {
  const { rows } = await query(
    `SELECT id, status, expires_at
     FROM public.role_x_user_x_empresa
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const link = rows[0];
  if (!link) return;
  if (link.status === false) {
    throw forbidden('Seu perfil está bloqueado', { code: 'PROFILE_BLOCKED' });
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await query(
      'UPDATE public.role_x_user_x_empresa SET status = false WHERE id = $1',
      [link.id],
    );
    throw forbidden('Seu acesso expirou', { code: 'ACCESS_EXPIRED' });
  }
};

const ensureSignupRoleLink = async (userId, empresaId = null) => {
  const { rows: active } = await query(
    `SELECT id FROM public.role_x_user_x_empresa
     WHERE user_id = $1 AND status = true
     LIMIT 1`,
    [userId],
  );
  if (active[0]) return;

  const { rows: roleRows } = await query(
    `SELECT id FROM public.roles
     WHERE lower(roles) IN ('usuario', 'user')
     ORDER BY CASE WHEN lower(roles) = 'usuario' THEN 0 ELSE 1 END
     LIMIT 1`,
  );
  if (!roleRows[0]) {
    console.error('[LocalAuth] role usuario não encontrada em public.roles');
    return;
  }

  await query(
    `INSERT INTO public.role_x_user_x_empresa
      (user_id, roles_id, empresas_id, status, mei)
     VALUES ($1, $2, $3, true, false)`,
    [userId, roleRows[0].id, empresaId],
  );
};

/**
 * Cadastro local (public.users).
 */
export const localSignUp = async ({
  email,
  password,
  phone,
  displayName,
  inviteToken,
}) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }
  assertStrongPassword(password);

  const normalizedEmail = normalizeEmail(email);
  const { rows: existing } = await query(
    'SELECT id FROM public.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [normalizedEmail],
  );
  if (existing[0]) {
    throw badRequest('Este e-mail já está cadastrado.');
  }

  const meta = {
    display_name: displayName || null,
    phone: phone || null,
  };
  const passwordHash = hashPassword(password);

  let empresaId = null;
  if (inviteToken) {
    // Convites completos ficam para fase seguinte; token ignorado com log.
    console.warn('[LocalAuth] inviteToken recebido — processamento completo em fase seguinte');
  }

  const { rows } = await query(
    `INSERT INTO public.users
      (email, password_hash, phone, email_confirmed_at, raw_user_meta_data)
     VALUES ($1, $2, $3, now(), $4::jsonb)
     RETURNING id, email, phone, raw_user_meta_data`,
    [
      normalizedEmail,
      passwordHash,
      phone || null,
      JSON.stringify(meta),
    ],
  );
  const userRow = rows[0];

  // profiles criado pelo trigger; garante role se trigger falhar
  await query(
    `INSERT INTO public.profiles (id, role) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [userRow.id, ROLE_DEFAULT],
  );

  await ensureSignupRoleLink(userRow.id, empresaId);

  const accessToken = signLocalAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: 'authenticated',
    user_metadata: meta,
    app_metadata: { provider: 'email' },
  });

  const { role, empresaId: empId, mei } = await getRoleAndCompany(userRow.id);
  const session = buildSession(userRow, accessToken);

  return {
    user: session.user,
    userId: userRow.id,
    phone: userRow.phone || null,
    displayName: displayName || null,
    role,
    empresaId: empId,
    mei,
    session,
  };
};

export const localSignIn = async ({ email, password }) => {
  if (!email || !password) {
    throw badRequest('Email e senha são obrigatórios');
  }

  const normalizedEmail = normalizeEmail(email);
  const { rows } = await query(
    `SELECT id, email, phone, password_hash, raw_user_meta_data, banned_until, deleted_at
     FROM public.users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  const userRow = rows[0];
  if (!userRow || userRow.deleted_at) {
    throw unauthorized('Email ou senha incorretos');
  }
  if (userRow.banned_until && new Date(userRow.banned_until) > new Date()) {
    throw forbidden('Conta bloqueada');
  }
  if (!verifyPassword(password, userRow.password_hash)) {
    throw unauthorized('Email ou senha incorretos');
  }

  await ensureUserNotBlocked(userRow.id);

  const meta = userRow.raw_user_meta_data || {};
  const accessToken = signLocalAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: 'authenticated',
    user_metadata: meta,
    app_metadata: { provider: 'email' },
  });

  const { role, empresaId, mei } = await getRoleAndCompany(userRow.id);
  const session = buildSession(userRow, accessToken);

  return {
    user: session.user,
    userId: userRow.id,
    phone: userRow.phone || meta.phone || null,
    displayName: meta.display_name || null,
    role,
    empresaId,
    mei,
    session,
  };
};

export const localGetSession = async (accessToken) => {
  const user = verifyLocalAccessToken(accessToken);
  if (!user) return null;

  await ensureUserNotBlocked(user.id);
  const { role, empresaId, mei } = await getRoleAndCompany(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.user_metadata?.phone || null,
      displayName: user.user_metadata?.display_name || null,
    },
    access_token: accessToken,
    role,
    empresaId,
    mei,
  };
};

export const localSignOut = async () => {
  // JWT stateless — cliente descarta o token
};

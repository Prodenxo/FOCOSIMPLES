import { createPublicKey, verify } from 'node:crypto';
import { decodeJwtHeader } from './verifySupabaseAccessToken.js';

const base64UrlToBuffer = (input) => {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map();

const parseJwtPayload = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlToBuffer(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
};

const buildUserFromPayload = (payload) => {
  if (!payload?.sub) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  return {
    id: payload.sub,
    email: payload.email || null,
    role: payload.role || 'authenticated',
    app_metadata: payload.app_metadata || {},
    user_metadata: payload.user_metadata || {},
  };
};

const fetchJwks = async (supabaseUrl) => {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  if (!base) return null;

  const cached = jwksCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return cached?.keys || null;
    const data = await response.json();
    const keys = Array.isArray(data?.keys) ? data.keys : [];
    jwksCache.set(base, { keys, fetchedAt: Date.now() });
    return keys;
  } catch {
    return cached?.keys || null;
  } finally {
    clearTimeout(timeout);
  }
};

const verifyWithJwk = (token, jwk, alg) => {
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;
  const data = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64UrlToBuffer(signatureB64);

  try {
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    return verify(alg === 'ES256' ? 'sha256' : 'sha256', data, publicKey, signature);
  } catch {
    return false;
  }
};

/**
 * Valida JWT assinado com chaves assimétricas do Supabase (RS256/ES256) via JWKS.
 */
export const verifySupabaseAccessTokenWithJwks = async (token, supabaseUrl) => {
  const header = decodeJwtHeader(token);
  const alg = header?.alg;
  if (!alg || !['RS256', 'ES256'].includes(alg)) return null;

  const keys = await fetchJwks(supabaseUrl);
  if (!keys?.length) return null;

  const kid = header?.kid;
  const candidates = kid
    ? keys.filter((key) => key.kid === kid)
    : keys.filter((key) => key.alg === alg || !key.alg);

  for (const jwk of candidates) {
    if (verifyWithJwk(token, jwk, alg)) {
      return buildUserFromPayload(parseJwtPayload(token));
    }
  }

  return null;
};

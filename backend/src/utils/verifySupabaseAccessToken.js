import { createHmac, timingSafeEqual } from 'node:crypto';

const base64UrlToBuffer = (input) => {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

/**
 * Valida JWT do Supabase localmente (HS256) sem chamar a API Auth.
 * Retorna objeto compatível com req.user ou null se inválido/expirado.
 */
export const decodeJwtHeader = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlToBuffer(parts[0]).toString('utf8'));
  } catch {
    return null;
  }
};

export const verifySupabaseAccessToken = (token, jwtSecret) => {
  const secret = String(jwtSecret || '').trim();
  if (!token || !secret) return null;

  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const header = decodeJwtHeader(token);
  if (header?.alg && header.alg !== 'HS256') {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
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

  return {
    id: payload.sub,
    email: payload.email || null,
    role: payload.role || 'authenticated',
    app_metadata: payload.app_metadata || {},
    user_metadata: payload.user_metadata || {},
  };
};

export const isSupabaseAuthNetworkError = (error) => {
  const message = error instanceof Error ? error.message : String(error || '');
  const cause = error instanceof Error && error.cause ? String(error.cause) : '';
  const combined = `${message} ${cause}`.toLowerCase();
  return (
    combined.includes('fetch failed')
    || combined.includes('connect timeout')
    || combined.includes('und_err_connect_timeout')
    || combined.includes('econnreset')
    || combined.includes('enotfound')
    || combined.includes('network')
  );
};

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  isSupabaseAuthNetworkError,
  verifySupabaseAccessToken,
} from '../src/utils/verifySupabaseAccessToken.js';

const signTestJwt = (payload, secret) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
};

test('verifySupabaseAccessToken aceita JWT válido', () => {
  const secret = 'test-secret';
  const token = signTestJwt(
    {
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret,
  );
  const user = verifySupabaseAccessToken(token, secret);
  assert.equal(user?.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(user?.email, 'user@example.com');
});

test('verifySupabaseAccessToken rejeita JWT expirado', () => {
  const secret = 'test-secret';
  const token = signTestJwt(
    {
      sub: '11111111-1111-1111-1111-111111111111',
      exp: Math.floor(Date.now() / 1000) - 10,
    },
    secret,
  );
  assert.equal(verifySupabaseAccessToken(token, secret), null);
});

test('isSupabaseAuthNetworkError detecta timeout do undici', () => {
  const err = new TypeError('fetch failed');
  err.cause = new Error('Connect Timeout Error');
  assert.equal(isSupabaseAuthNetworkError(err), true);
});

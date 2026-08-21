import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_MODE = 'local';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:fake@localhost:5432/focosimples';
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || 'test-jwt-secret-focosimples-local';

const { getServiceDbConfigError } = await import('../src/config/supabase.js');

test('getServiceDbConfigError — AUTH_MODE=local ok com DATABASE_URL', () => {
  assert.equal(getServiceDbConfigError(), null);
});

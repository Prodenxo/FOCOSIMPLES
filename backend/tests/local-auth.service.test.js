import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_MODE = 'local';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:fake@localhost:5432/focosimples';
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || 'test-jwt-secret-focosimples-local';

const {
  hashPassword,
  verifyPassword,
  signLocalAccessToken,
  verifyLocalAccessToken,
} = await import('../src/services/local-auth.service.js');

test('hashPassword / verifyPassword — roundtrip', () => {
  const hash = hashPassword('Senha@Forte1');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(verifyPassword('Senha@Forte1', hash), true);
  assert.equal(verifyPassword('outra', hash), false);
});

test('signLocalAccessToken / verifyLocalAccessToken — roundtrip', () => {
  const token = signLocalAccessToken({
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'a@b.com',
    role: 'authenticated',
    user_metadata: { display_name: 'Teste' },
  });
  const user = verifyLocalAccessToken(token);
  assert.ok(user);
  assert.equal(user.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(user.email, 'a@b.com');
  assert.equal(user.user_metadata.display_name, 'Teste');
});

test('verifyLocalAccessToken rejeita token adulterado', () => {
  const token = signLocalAccessToken({
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'a@b.com',
  });
  const broken = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifyLocalAccessToken(broken), null);
});

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
  resolveLocalUserProfile,
  signLocalAccessToken,
  verifyLocalAccessToken,
} = await import('../src/services/local-auth.service.js');

const fakeQuery = (row) => async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });

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

test('resolveLocalUserProfile prefere o banco ao token (alteração não volta)', async () => {
  const tokenUser = {
    email: 'antigo@teste.com',
    user_metadata: { phone: '5521996185328', display_name: 'Nome Antigo' },
  };
  const profile = await resolveLocalUserProfile('u1', tokenUser, {
    query: fakeQuery({
      email: 'novo@teste.com',
      phone: '5521996185377',
      raw_user_meta_data: { phone: '5521996185377', display_name: 'Nome Novo' },
    }),
  });

  assert.deepEqual(profile, {
    email: 'novo@teste.com',
    phone: '5521996185377',
    displayName: 'Nome Novo',
  });
});

test('resolveLocalUserProfile cai no token quando o banco não traz o campo', async () => {
  const tokenUser = {
    email: 'antigo@teste.com',
    user_metadata: { phone: '5521996185328', display_name: 'Nome Antigo' },
  };

  const semLinha = await resolveLocalUserProfile('u1', tokenUser, { query: fakeQuery(null) });
  assert.deepEqual(semLinha, {
    email: 'antigo@teste.com',
    phone: '5521996185328',
    displayName: 'Nome Antigo',
  });

  const semTelefone = await resolveLocalUserProfile('u1', tokenUser, {
    query: fakeQuery({ email: 'novo@teste.com', phone: null, raw_user_meta_data: {} }),
  });
  assert.equal(semTelefone.email, 'novo@teste.com');
  assert.equal(semTelefone.phone, '5521996185328');
});

test('verifyLocalAccessToken rejeita token adulterado', () => {
  const token = signLocalAccessToken({
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'a@b.com',
  });
  const broken = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifyLocalAccessToken(broken), null);
});

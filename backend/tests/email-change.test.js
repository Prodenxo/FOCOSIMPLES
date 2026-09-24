import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

process.env.AUTH_MODE = 'local';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://focosimples.com.br';

const {
  buildEmailChangeConfirmUrl,
  confirmLocalEmailChange,
  requestLocalEmailChange,
} = await import('../src/services/email-change.service.js');

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

/** Banco em memória: responde cada SQL do serviço e guarda o estado resultante. */
const buildFakeDb = ({ users = [], requests = [] } = {}) => {
  const state = { users: [...users], requests: [...requests] };

  const query = async (sql, params = []) => {
    if (/SELECT email FROM public\.users/i.test(sql)) {
      const found = state.users.find((u) => u.id === params[0]);
      return { rows: found ? [{ email: found.email }] : [], rowCount: found ? 1 : 0 };
    }
    if (/SELECT id FROM public\.users/i.test(sql)) {
      const taken = state.users.find((u) => u.email === params[0] && u.id !== params[1]);
      return { rows: taken ? [{ id: taken.id }] : [], rowCount: taken ? 1 : 0 };
    }
    if (/DELETE FROM public\.email_change_requests/i.test(sql)) {
      state.requests = state.requests.filter((r) => r.user_id !== params[0] || r.confirmed_at);
      return { rows: [], rowCount: 0 };
    }
    if (/INSERT INTO public\.email_change_requests/i.test(sql)) {
      const [user_id, new_email, token_hash, expires_at] = params;
      state.requests.push({
        id: `req-${state.requests.length + 1}`,
        user_id,
        new_email,
        token_hash,
        expires_at,
        confirmed_at: null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT id, user_id, new_email/i.test(sql)) {
      const found = state.requests.find(
        (r) => r.token_hash === params[0]
          && !r.confirmed_at
          && new Date(r.expires_at) > new Date(),
      );
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }
    if (/UPDATE public\.users\s+SET email/i.test(sql)) {
      const target = state.users.find((u) => u.id === params[0]);
      if (target) target.email = params[1];
      return { rows: [], rowCount: target ? 1 : 0 };
    }
    if (/UPDATE public\.email_change_requests SET confirmed_at/i.test(sql)) {
      const found = state.requests.find((r) => r.id === params[0]);
      if (found) found.confirmed_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`SQL não previsto no teste: ${sql.replace(/\s+/g, ' ').trim()}`);
  };

  return { query, state };
};

const buildDeps = (db) => {
  const sent = [];
  return {
    sent,
    deps: {
      query: db.query,
      sendEmail: async (payload) => { sent.push(payload); },
    },
  };
};

test('buildEmailChangeConfirmUrl aponta para /confirmar-email com o token', () => {
  const url = new URL(buildEmailChangeConfirmUrl('abc123'));
  assert.equal(url.pathname, '/confirmar-email');
  assert.equal(url.searchParams.get('token'), 'abc123');
});

test('pedido de troca grava só o hash e envia link ao novo e-mail', async () => {
  const db = buildFakeDb({ users: [{ id: 'u1', email: 'antigo@teste.com' }] });
  const { sent, deps } = buildDeps(db);

  const result = await requestLocalEmailChange('u1', '  NOVO@Teste.com ', deps);
  assert.deepEqual(result, { email: 'novo@teste.com' });

  const saved = db.state.requests[0];
  assert.equal(saved.new_email, 'novo@teste.com');
  assert.equal(saved.token_hash.length, 64, 'token_hash deve ser sha256 hex');
  assert.equal(new Date(saved.expires_at) > new Date(), true);

  const tokenNoEmail = new URL(sent[0].html.match(/href="([^"]+)"/)[1])
    .searchParams.get('token');
  assert.equal(
    sha256(tokenNoEmail),
    saved.token_hash,
    'token do e-mail deve corresponder ao hash guardado',
  );

  assert.deepEqual(
    sent.map((e) => e.to),
    ['novo@teste.com', 'antigo@teste.com'],
    'avisa o novo endereço e o atual',
  );
});

test('novo pedido invalida o link anterior da mesma conta', async () => {
  const db = buildFakeDb({ users: [{ id: 'u1', email: 'antigo@teste.com' }] });
  const { deps } = buildDeps(db);

  await requestLocalEmailChange('u1', 'primeiro@teste.com', deps);
  const primeiroHash = db.state.requests[0].token_hash;

  await requestLocalEmailChange('u1', 'segundo@teste.com', deps);
  assert.equal(db.state.requests.length, 1, 'só um pedido em aberto por conta');
  assert.notEqual(db.state.requests[0].token_hash, primeiroHash);
});

test('pedido recusa e-mail igual ao atual, inválido e já usado por outra conta', async () => {
  const db = buildFakeDb({
    users: [
      { id: 'u1', email: 'antigo@teste.com' },
      { id: 'u2', email: 'ocupado@teste.com' },
    ],
  });
  const { sent, deps } = buildDeps(db);

  await assert.rejects(
    () => requestLocalEmailChange('u1', 'antigo@teste.com', deps),
    /diferente do atual/i,
  );
  await assert.rejects(
    () => requestLocalEmailChange('u1', 'sem-arroba', deps),
    /inválido/i,
  );
  await assert.rejects(
    () => requestLocalEmailChange('u1', 'ocupado@teste.com', deps),
    /já está em uso/i,
  );
  assert.equal(sent.length, 0, 'nada é enviado quando o pedido é recusado');
  assert.equal(db.state.requests.length, 0);
});

test('confirmação troca o e-mail da conta e queima o token', async () => {
  const rawToken = 'token-valido';
  const db = buildFakeDb({
    users: [{ id: 'u1', email: 'antigo@teste.com' }],
    requests: [{
      id: 'req-1',
      user_id: 'u1',
      new_email: 'novo@teste.com',
      token_hash: sha256(rawToken),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      confirmed_at: null,
    }],
  });
  const { deps } = buildDeps(db);

  const result = await confirmLocalEmailChange(rawToken, deps);
  assert.deepEqual(result, { email: 'novo@teste.com' });
  assert.equal(db.state.users[0].email, 'novo@teste.com');
  assert.equal(Boolean(db.state.requests[0].confirmed_at), true);

  await assert.rejects(
    () => confirmLocalEmailChange(rawToken, deps),
    /inválido ou expirado/i,
    'token não serve duas vezes',
  );
});

test('confirmação recusa token vazio, desconhecido e expirado', async () => {
  const rawToken = 'token-expirado';
  const db = buildFakeDb({
    users: [{ id: 'u1', email: 'antigo@teste.com' }],
    requests: [{
      id: 'req-1',
      user_id: 'u1',
      new_email: 'novo@teste.com',
      token_hash: sha256(rawToken),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      confirmed_at: null,
    }],
  });
  const { deps } = buildDeps(db);

  await assert.rejects(() => confirmLocalEmailChange('', deps), /Link inválido/i);
  await assert.rejects(
    () => confirmLocalEmailChange('nao-existe', deps),
    /inválido ou expirado/i,
  );
  await assert.rejects(
    () => confirmLocalEmailChange(rawToken, deps),
    /inválido ou expirado/i,
  );
  assert.equal(db.state.users[0].email, 'antigo@teste.com', 'e-mail não muda');
});

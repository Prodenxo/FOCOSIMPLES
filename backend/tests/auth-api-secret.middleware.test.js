import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth } from '../src/middlewares/auth.js';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

test('API_SECRET sem user id devolve 400', async (t) => {
  t.after(() => {
    delete process.env.API_SECRET;
  });
  process.env.API_SECRET = 'integration-test-secret-only';

  const req = {
    headers: { authorization: 'Bearer integration-test-secret-only' },
    query: {},
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.ok(err);
  assert.equal(err.status, 400);
});

test('API_SECRET com X-MeuFinanceiro-User-Id define req.user', async (t) => {
  t.after(() => {
    delete process.env.API_SECRET;
  });
  process.env.API_SECRET = 'integration-test-secret-only';

  const req = {
    headers: {
      authorization: 'Bearer integration-test-secret-only',
      'x-meufinanceiro-user-id': SAMPLE_UUID,
    },
    query: {},
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.equal(err, undefined);
  assert.equal(req.user?.id, SAMPLE_UUID);
  assert.equal(req.authType, 'api_key');
});

test('API_SECRET aceita userId na query', async (t) => {
  t.after(() => {
    delete process.env.API_SECRET;
  });
  process.env.API_SECRET = 'integration-test-secret-only';

  const req = {
    headers: { authorization: 'Bearer integration-test-secret-only' },
    query: { userId: SAMPLE_UUID },
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.equal(err, undefined);
  assert.equal(req.user?.id, SAMPLE_UUID);
});

test('OPENCLAW_WEBHOOK_SECRET só autentica GET /api/categories com user id', async (t) => {
  t.after(() => {
    delete process.env.OPENCLAW_WEBHOOK_SECRET;
    delete process.env.API_SECRET;
    delete process.env.API_SECRET_OP;
  });
  delete process.env.API_SECRET;
  delete process.env.API_SECRET_OP;
  process.env.OPENCLAW_WEBHOOK_SECRET = 'claw-test-secret';

  const reqOk = {
    method: 'GET',
    originalUrl: '/api/categories?minimal=true',
    headers: {
      authorization: 'Bearer claw-test-secret',
      'x-meufinanceiro-user-id': SAMPLE_UUID,
    },
    query: { minimal: 'true' },
  };
  let errOk;
  await requireAuth(reqOk, {}, (e) => {
    errOk = e;
  });
  assert.equal(errOk, undefined);
  assert.equal(reqOk.user?.id, SAMPLE_UUID);
  assert.equal(reqOk.authType, 'api_key');

  const reqWrongPath = {
    method: 'GET',
    originalUrl: '/api/transactions',
    headers: {
      authorization: 'Bearer claw-test-secret',
      'x-meufinanceiro-user-id': SAMPLE_UUID,
    },
    query: {},
  };
  let errPath;
  await requireAuth(reqWrongPath, {}, (e) => {
    errPath = e;
  });
  assert.ok(errPath);
  assert.equal(errPath.status, 401);
});

test('OPENCLAW_WEBHOOK_SECRET GET categories sem user id devolve 400', async (t) => {
  t.after(() => {
    delete process.env.OPENCLAW_WEBHOOK_SECRET;
    delete process.env.API_SECRET;
    delete process.env.API_SECRET_OP;
  });
  delete process.env.API_SECRET;
  delete process.env.API_SECRET_OP;
  process.env.OPENCLAW_WEBHOOK_SECRET = 'claw-test-secret';

  const req = {
    method: 'GET',
    originalUrl: '/api/categories',
    headers: { authorization: 'Bearer claw-test-secret' },
    query: {},
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.ok(err);
  assert.equal(err.status, 400);
});

test('API_SECRET_OP com userId na query (API_SECRET principal diferente)', async (t) => {
  t.after(() => {
    delete process.env.API_SECRET;
    delete process.env.API_SECRET_OP;
  });
  process.env.API_SECRET = 'other-integration-secret';
  process.env.API_SECRET_OP = 'openclaw-op-test-secret';

  const req = {
    headers: {
      authorization: 'Bearer openclaw-op-test-secret',
    },
    query: { userId: SAMPLE_UUID },
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.equal(err, undefined);
  assert.equal(req.user?.id, SAMPLE_UUID);
  assert.equal(req.authType, 'api_key');
});

test('API_SECRET com aspas no valor do ambiente ainda autentica', async (t) => {
  t.after(() => {
    delete process.env.API_SECRET;
    delete process.env.API_SECRET_OP;
  });
  delete process.env.API_SECRET_OP;
  process.env.API_SECRET = '"quoted-secret-value"';

  const req = {
    headers: {
      authorization: 'Bearer quoted-secret-value',
      'x-meufinanceiro-user-id': SAMPLE_UUID,
    },
    query: {},
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.equal(err, undefined);
  assert.equal(req.user?.id, SAMPLE_UUID);
});

test('OPENCLAW_WEBHOOK_SECRET aceita user_id (snake_case) na query', async (t) => {
  t.after(() => {
    delete process.env.OPENCLAW_WEBHOOK_SECRET;
    delete process.env.API_SECRET;
    delete process.env.API_SECRET_OP;
  });
  delete process.env.API_SECRET;
  delete process.env.API_SECRET_OP;
  process.env.OPENCLAW_WEBHOOK_SECRET = 'claw-test-secret';

  const req = {
    method: 'GET',
    originalUrl: '/api/categories?minimal=true',
    headers: { authorization: 'Bearer claw-test-secret' },
    query: { minimal: 'true', user_id: SAMPLE_UUID },
  };
  let err;
  await requireAuth(req, {}, (e) => {
    err = e;
  });
  assert.equal(err, undefined);
  assert.equal(req.user?.id, SAMPLE_UUID);
});

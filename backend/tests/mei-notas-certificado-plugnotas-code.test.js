import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';

const createJsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 409 ? 'Conflict' : 'Error',
  headers: { get: () => 'application/json' },
  json: async () => payload
});

test('resposta HTTP 400 de cadastro certificado inclui plugnotasCode certificado_409_sem_id após 409 sem resolução (US-MEI-FISC-02)', async () => {
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });

  let caught;
  try {
    const buf = new Uint8Array([1]);
    await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'x.pfx',
      password: 'p'
    });
    assert.fail('esperava rejeição');
  } catch (err) {
    caught = err;
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(caught.status, 400);
  assert.equal(caught.errors?.plugnotasCode, 'certificado_409_sem_id');

  const req = {
    method: 'POST',
    originalUrl: '/api/mei-notas/setup/emissao-fiscal/certificado',
    params: {},
    query: {},
    body: {}
  };
  const payload = {};
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      Object.assign(payload, body);
      return this;
    }
  };

  errorHandler(caught, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.data, null);
  assert.ok(typeof payload.message === 'string' && payload.message.length > 0);
  assert.equal(payload.errors?.plugnotasCode, 'certificado_409_sem_id');
});

test('erros de certificado sem código estável expõem errors null no JSON (escopo US-MEI-FISC-02: só certificado_409_sem_id)', async () => {
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const { badRequest } = await import('../src/utils/errors.js');
  const err = badRequest('Arquivo do certificado é obrigatório');

  const req = { method: 'POST', originalUrl: '/test', params: {}, query: {}, body: {} };
  const payload = {};
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      Object.assign(payload, body);
      return this;
    }
  };

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.errors, null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import { createServer } from 'node:http';

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

test('HTTP POST /api/mei-notas/setup/emissao-fiscal/certificado — 409 sem resolução inclui plugnotasCode (mitigação QA US-MEI-FISC-02)', async () => {
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const {
    __setGetRequesterContextForTests,
    requireMeiEnabled
  } = await import('../src/middlewares/requireMei.js');
  const controller = await import('../src/controllers/mei-notas.controller.js');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'e2e-cert-user' };
    req.accessToken = 'e2e-cert-token';
    next();
  });
  app.post(
    '/api/mei-notas/setup/emissao-fiscal/certificado',
    requireMeiEnabled,
    upload.single('arquivo'),
    controller.cadastrarPlugNotasCertificado
  );
  app.use(errorHandler);

  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('127.0.0.1') || u.includes('localhost')) {
      return originalFetch(url, init);
    }
    return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
  };

  __setGetRequesterContextForTests(async () => ({ role: 'admin', mei: true }));

  const server = createServer(app);
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    const body = new FormData();
    body.append('arquivo', new Blob([new Uint8Array([1])]), 'x.pfx');
    body.append('senha', 'p');

    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/setup/emissao-fiscal/certificado`, {
      method: 'POST',
      body
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.errors?.plugnotasCode, 'certificado_409_sem_id');
    const { getPlugnotasCodeFromApiErrors } = await import('../src/utils/plugnotas-api-error-code.js');
    assert.equal(getPlugnotasCodeFromApiErrors(json.errors), 'certificado_409_sem_id');
    assert.ok(typeof json.message === 'string' && json.message.length > 10);
  } finally {
    global.fetch = originalFetch;
    __setGetRequesterContextForTests(null);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

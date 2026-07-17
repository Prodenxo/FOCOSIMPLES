import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

import meiNotasRouter from '../src/routes/mei-notas.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const listenApp = (app) => new Promise((resolve) => {
  const server = createServer(app);
  server.listen(0, () => resolve(server));
});

const runCatalogAuthCases = async (method, pathSuffix, bodyObj = null) => {
  const app = express();
  app.use(express.json());
  app.use('/api/mei-notas', meiNotasRouter);
  app.use(errorHandler);

  const server = await listenApp(app);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}/api/mei-notas${pathSuffix}`;

  try {
    const init = { method };
    if (bodyObj !== null) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(base, init);
    assert.equal(res.status, 401, `${method} ${pathSuffix} sem Bearer deve ser 401`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message);
  } finally {
    await new Promise((r) => server.close(r));
  }
};

test('HTTP catálogo — 401 sem Authorization em POST /catalogo/clientes', async () => {
  await runCatalogAuthCases('POST', '/catalogo/clientes', { nome: 'X', documento: '12345678000199' });
});

test('HTTP catálogo — 401 sem Authorization em PATCH /catalogo/clientes/:id', async () => {
  await runCatalogAuthCases('PATCH', '/catalogo/clientes/550e8400-e29b-41d4-a716-446655440000', { nome: 'Y' });
});

test('HTTP catálogo — 401 sem Authorization em POST /catalogo/produtos', async () => {
  await runCatalogAuthCases('POST', '/catalogo/produtos', { discriminacao: 'Serviço' });
});

test('HTTP catálogo — 401 sem Authorization em PATCH /catalogo/produtos/:id', async () => {
  await runCatalogAuthCases('PATCH', '/catalogo/produtos/660e8400-e29b-41d4-a716-446655440001', {
    discriminacao: 'Atualizado'
  });
});

test('HTTP catálogo — 401 sem Authorization em DELETE /catalogo/clientes/:id', async () => {
  await runCatalogAuthCases('DELETE', '/catalogo/clientes/550e8400-e29b-41d4-a716-446655440000', null);
});

test('HTTP catálogo — 401 sem Authorization em DELETE /catalogo/produtos/:id', async () => {
  await runCatalogAuthCases('DELETE', '/catalogo/produtos/660e8400-e29b-41d4-a716-446655440001', null);
});

test('HTTP catálogo — 401 sem Authorization em GET /catalogo/codigos-servicos', async () => {
  await runCatalogAuthCases('GET', '/catalogo/codigos-servicos', null);
});

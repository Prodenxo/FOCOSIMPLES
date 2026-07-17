import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

import { errorHandler } from '../src/middlewares/errorHandler.js';
import {
  __setGetRequesterContextForTests,
  requireMeiEnabled
} from '../src/middlewares/requireMei.js';
import * as controller from '../src/controllers/mei-notas.controller.js';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const CLIENTS_TABLE = 'mei_nfse_clientes';
const PRODUCTS_TABLE = 'mei_nfse_produtos';
const CODIGOS_SERVICOS_TABLE = 'codigosservicos';
const USER_ID = 'http-cat-delete-user';

const matchesCodigoServicoIlike = (text, pctPattern) => {
  const inner = String(pctPattern || '')
    .replace(/^%/, '')
    .replace(/%$/, '')
    .toLowerCase();
  return String(text || '').toLowerCase().includes(inner);
};

/** Mock `codigosservicos` para wire HTTP (paridade com `mei-notas-codigos-servicos.test.js`). */
function createCodigosServicosRefWireMock({ rows }) {
  const sorted = [...rows].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));
  return {
    from(table) {
      assert.equal(table, CODIGOS_SERVICOS_TABLE);
      return {
        select() {
          return {
            order(col, opts) {
              assert.equal(col, 'codigo');
              assert.equal(opts?.ascending, true);
              return {
                limit(n) {
                  const tail = {
                    or(filterStr) {
                      const parts = String(filterStr).split(',');
                      const likeRaw = parts[0]?.split('.ilike.')[1] ?? '';
                      const filtered = sorted.filter(
                        (r) => matchesCodigoServicoIlike(r.codigo, likeRaw)
                          || matchesCodigoServicoIlike(r.descricao, likeRaw)
                      );
                      return Promise.resolve({ data: filtered.slice(0, n), error: null });
                    },
                    then(onFulfilled, onRejected) {
                      return Promise.resolve({ data: sorted.slice(0, n), error: null }).then(
                        onFulfilled,
                        onRejected
                      );
                    }
                  };
                  return tail;
                }
              };
            }
          };
        }
      };
    }
  };
}

const listenApp = (app) =>
  new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, () => resolve(server));
  });

const injectSession = (req, _res, next) => {
  req.user = { id: USER_ID };
  req.accessToken = 'test-access-token';
  next();
};

/** Mock in-memory clientes: DELETE + listagem + lookup por id (eliminar). */
function createClientesCatalogStateMock(initialRows) {
  let rows = initialRows.map((r) => ({ ...r }));
  return {
    from(t) {
      assert.equal(t, CLIENTS_TABLE);
      return {
        delete() {
          return {
            eq(c1, v1) {
              assert.equal(c1, 'id');
              return {
                eq(c2, v2) {
                  assert.equal(c2, 'user_id');
                  return {
                    select() {
                      const idx = rows.findIndex((r) => r.id === v1 && r.user_id === v2);
                      if (idx >= 0) {
                        rows.splice(idx, 1);
                        return Promise.resolve({ data: [{ id: v1 }], error: null });
                      }
                      return Promise.resolve({ data: [], error: null });
                    }
                  };
                }
              };
            }
          };
        },
        select() {
          return {
            eq(c1, v1) {
              if (c1 === 'id') {
                return {
                  maybeSingle() {
                    const row = rows.find((r) => r.id === v1) ?? null;
                    return Promise.resolve({ data: row, error: null });
                  }
                };
              }
              if (c1 === 'user_id') {
                return {
                  eq(c2, v2) {
                    assert.equal(c2, 'document_type');
                    return {
                      order() {
                        return {
                          limit(n) {
                            const filtered = rows
                              .filter((r) => r.user_id === v1 && r.document_type === v2)
                              .sort((a, b) =>
                                String(b.last_used_at).localeCompare(String(a.last_used_at))
                              );
                            return Promise.resolve({ data: filtered.slice(0, n), error: null });
                          }
                        };
                      }
                    };
                  }
                };
              }
              throw new Error(`select.eq inesperado: ${c1}`);
            }
          };
        }
      };
    }
  };
}

/** Mock in-memory produtos: DELETE + listagem + lookup por id. */
function createProdutosCatalogStateMock(initialRows) {
  let rows = initialRows.map((r) => ({ ...r }));
  return {
    from(t) {
      assert.equal(t, PRODUCTS_TABLE);
      return {
        delete() {
          return {
            eq(c1, v1) {
              assert.equal(c1, 'id');
              return {
                eq(c2, v2) {
                  assert.equal(c2, 'user_id');
                  return {
                    select() {
                      const idx = rows.findIndex((r) => r.id === v1 && r.user_id === v2);
                      if (idx >= 0) {
                        rows.splice(idx, 1);
                        return Promise.resolve({ data: [{ id: v1 }], error: null });
                      }
                      return Promise.resolve({ data: [], error: null });
                    }
                  };
                }
              };
            }
          };
        },
        select() {
          return {
            eq(c1, v1) {
              if (c1 === 'id') {
                return {
                  maybeSingle() {
                    const row = rows.find((r) => r.id === v1) ?? null;
                    return Promise.resolve({ data: row, error: null });
                  }
                };
              }
              if (c1 === 'user_id') {
                return {
                  eq(c2, v2) {
                    assert.equal(c2, 'document_type');
                    return {
                      order() {
                        return {
                          limit(n) {
                            const filtered = rows
                              .filter((r) => r.user_id === v1 && r.document_type === v2)
                              .sort((a, b) =>
                                String(b.last_used_at).localeCompare(String(a.last_used_at))
                              );
                            return Promise.resolve({ data: filtered.slice(0, n), error: null });
                          }
                        };
                      }
                    };
                  }
                };
              }
              throw new Error(`select.eq inesperado: ${c1}`);
            }
          };
        }
      };
    }
  };
}

function buildCatalogWireApp(routes) {
  const app = express();
  app.use(injectSession);
  routes(app);
  app.use(errorHandler);
  return app;
}

afterEach(async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__resetGetDbForTests();
  __setGetRequesterContextForTests(null);
});

test('HTTP DELETE /catalogo/clientes/:id — 204 e corpo vazio (mitigação QA)', async () => {
  const recordId = '550e8400-e29b-41d4-a716-446655440000';
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() =>
    createClientesCatalogStateMock([
      {
        id: recordId,
        user_id: USER_ID,
        document_type: 'NFSE',
        documento: '12345678000199',
        nome: 'Cliente HTTP',
        email: null,
        metadata_json: null,
        last_used_at: '2026-03-30T12:00:00.000Z',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-30T12:00:00.000Z'
      }
    ])
  );
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: true }));

  const app = buildCatalogWireApp((a) => {
    a.delete(
      '/api/mei-notas/catalogo/clientes/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoCliente
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/mei-notas/catalogo/clientes/${recordId}`,
      { method: 'DELETE' }
    );
    assert.equal(res.status, 204);
    const text = await res.text();
    assert.equal(text, '');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP DELETE /catalogo/produtos/:id — 204 e corpo vazio (mitigação QA)', async () => {
  const recordId = '660e8400-e29b-41d4-a716-446655440001';
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() =>
    createProdutosCatalogStateMock([
      {
        id: recordId,
        user_id: USER_ID,
        document_type: 'NFSE',
        codigo: '010101',
        cnae: '6201500',
        discriminacao: 'Serviço teste',
        aliquota: null,
        valor_sugerido: null,
        metadata_json: null,
        last_used_at: '2026-03-30T12:00:00.000Z',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-30T12:00:00.000Z'
      }
    ])
  );
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: true }));

  const app = buildCatalogWireApp((a) => {
    a.delete(
      '/api/mei-notas/catalogo/produtos/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoProduto
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/mei-notas/catalogo/produtos/${recordId}`,
      { method: 'DELETE' }
    );
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP GET /catalogo/codigos-servicos — 200 com mock (wire, mitigação QA)', async () => {
  const rows = [
    { codigo: '01.01', descricao: 'Serviço A' },
    { codigo: '02.02', descricao: 'Serviço B' }
  ];
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => createCodigosServicosRefWireMock({ rows }));
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: true }));

  const app = buildCatalogWireApp((a) => {
    a.get(
      '/api/mei-notas/catalogo/codigos-servicos',
      requireMeiEnabled,
      controller.listarCatalogoCodigosServicos
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/catalogo/codigos-servicos`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 2);
    assert.equal(json.data[0].codigo, '01.01');
    assert.equal(json.data[1].codigo, '02.02');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP DELETE catálogo — 403 quando MEI desabilitado (mitigação QA)', async () => {
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: false }));

  const app = buildCatalogWireApp((a) => {
    a.delete(
      '/api/mei-notas/catalogo/clientes/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoCliente
    );
    a.delete(
      '/api/mei-notas/catalogo/produtos/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoProduto
    );
    a.get(
      '/api/mei-notas/catalogo/codigos-servicos',
      requireMeiEnabled,
      controller.listarCatalogoCodigosServicos
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  try {
    const cid = '550e8400-e29b-41d4-a716-446655440000';
    const pid = '660e8400-e29b-41d4-a716-446655440001';
    for (const { url, method } of [
      { url: `http://127.0.0.1:${port}/api/mei-notas/catalogo/clientes/${cid}`, method: 'DELETE' },
      { url: `http://127.0.0.1:${port}/api/mei-notas/catalogo/produtos/${pid}`, method: 'DELETE' },
      { url: `http://127.0.0.1:${port}/api/mei-notas/catalogo/codigos-servicos`, method: 'GET' }
    ]) {
      const res = await fetch(url, { method });
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /MEI/i);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP GET /catalogo/clientes após DELETE — registo removido da listagem (mitigação QA)', async () => {
  const keepId = '550e8400-e29b-41d4-a716-446655440001';
  const dropId = '550e8400-e29b-41d4-a716-446655440002';
  const baseRow = {
    user_id: USER_ID,
    document_type: 'NFSE',
    documento: '12345678000199',
    nome: 'X',
    email: null,
    metadata_json: null,
    last_used_at: '2026-03-30T12:00:00.000Z',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-30T12:00:00.000Z'
  };
  const mod = await import('../src/services/mei-notas.service.js');
  const sharedClientesMock = createClientesCatalogStateMock([
    { ...baseRow, id: keepId, nome: 'Mantém' },
    { ...baseRow, id: dropId, nome: 'Apaga', last_used_at: '2026-03-30T13:00:00.000Z' }
  ]);
  mod.__setGetDbForTests(() => sharedClientesMock);
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: true }));

  const app = buildCatalogWireApp((a) => {
    a.get(
      '/api/mei-notas/catalogo/clientes',
      requireMeiEnabled,
      controller.listarCatalogoClientes
    );
    a.delete(
      '/api/mei-notas/catalogo/clientes/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoCliente
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  const base = `http://127.0.0.1:${port}/api/mei-notas/catalogo/clientes`;
  try {
    const resListBefore = await fetch(base);
    assert.equal(resListBefore.status, 200);
    const before = await resListBefore.json();
    assert.equal(before.data.length, 2);
    assert.ok(before.data.some((r) => r.id === dropId));

    const resDel = await fetch(`${base}/${dropId}`, { method: 'DELETE' });
    assert.equal(resDel.status, 204);

    const resListAfter = await fetch(base);
    assert.equal(resListAfter.status, 200);
    const after = await resListAfter.json();
    assert.equal(after.data.length, 1);
    assert.equal(after.data[0].id, keepId);
    assert.ok(!after.data.some((r) => r.id === dropId));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP segundo DELETE no mesmo id — 204 idempotente (wire)', async () => {
  const recordId = '550e8400-e29b-41d4-a716-446655440099';
  const mod = await import('../src/services/mei-notas.service.js');
  const idempotentMock = createClientesCatalogStateMock([
    {
      id: recordId,
      user_id: USER_ID,
      document_type: 'NFSE',
      documento: '12345678000199',
      nome: 'Once',
      email: null,
      metadata_json: null,
      last_used_at: '2026-03-30T12:00:00.000Z',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-30T12:00:00.000Z'
    }
  ]);
  mod.__setGetDbForTests(() => idempotentMock);
  __setGetRequesterContextForTests(async () => ({ role: 'user', mei: true }));

  const app = buildCatalogWireApp((a) => {
    a.delete(
      '/api/mei-notas/catalogo/clientes/:id',
      requireMeiEnabled,
      controller.eliminarCatalogoCliente
    );
  });
  const server = await listenApp(app);
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  const url = `http://127.0.0.1:${port}/api/mei-notas/catalogo/clientes/${recordId}`;
  try {
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 204);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

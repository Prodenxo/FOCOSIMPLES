import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const CLIENTS_TABLE = 'mei_nfse_clientes';
const PRODUCTS_TABLE = 'mei_nfse_produtos';

/**
 * Encadeamento mínimo compatível com as queries de catálogo (upsert/select/update).
 */
const createCatalogSupabaseMock = () => {
  const clienteId = '550e8400-e29b-41d4-a716-446655440000';
  const produtoId = '660e8400-e29b-41d4-a716-446655440001';
  const userId = 'user-happy-1';
  let lastClienteUpsertRow = null;

  const clienteStub = {
    id: clienteId,
    user_id: userId,
    document_type: 'NFSE',
    documento: '12345678000199',
    nome: 'Cliente Antigo',
    email: null,
    metadata_json: null,
    dedupe_key: 'doc:12345678000199',
    last_used_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };

  const produtoStub = {
    id: produtoId,
    user_id: userId,
    document_type: 'NFSE',
    codigo: 'S1',
    cnae: '',
    discriminacao: 'Serviço antigo',
    aliquota: null,
    valor_sugerido: null,
    metadata_json: null,
    dedupe_key: 'manual:existing',
    last_used_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };

  const client = {
    from(table) {
      if (table === CLIENTS_TABLE) {
        return {
          upsert(row) {
            lastClienteUpsertRow = row;
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: clienteId,
                      document_type: row.document_type,
                      documento: row.documento,
                      nome: row.nome,
                      email: row.email ?? null,
                      metadata_json: row.metadata_json ?? null,
                      last_used_at: row.last_used_at,
                      created_at: '2026-01-01T00:00:00.000Z',
                      updated_at: row.updated_at
                    },
                    error: null
                  })
                };
              }
            };
          },
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: { ...clienteStub }, error: null })
                    };
                  }
                };
              }
            };
          },
          update(updates) {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select() {
                        return {
                          single: async () => ({
                            data: {
                              id: clienteId,
                              document_type: 'NFSE',
                              documento: '12345678000199',
                              nome: updates.nome ?? clienteStub.nome,
                              email: updates.email !== undefined ? updates.email : clienteStub.email,
                              metadata_json: updates.metadata_json !== undefined
                                ? updates.metadata_json
                                : clienteStub.metadata_json,
                              last_used_at: updates.last_used_at,
                              created_at: '2026-01-01T00:00:00.000Z',
                              updated_at: updates.updated_at
                            },
                            error: null
                          })
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
      if (table === PRODUCTS_TABLE) {
        return {
          insert(row) {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: produtoId,
                      document_type: row.document_type,
                      codigo: row.codigo,
                      cnae: row.cnae,
                      discriminacao: row.discriminacao,
                      aliquota: row.aliquota,
                      valor_sugerido: row.valor_sugerido,
                      metadata_json: row.metadata_json ?? null,
                      dedupe_key: row.dedupe_key,
                      last_used_at: row.last_used_at,
                      created_at: '2026-01-01T00:00:00.000Z',
                      updated_at: row.updated_at
                    },
                    error: null
                  })
                };
              }
            };
          },
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: { ...produtoStub }, error: null })
                    };
                  }
                };
              }
            };
          },
          update(updates) {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select() {
                        return {
                          single: async () => ({
                            data: {
                              id: produtoId,
                              document_type: 'NFSE',
                              codigo: updates.codigo !== undefined ? updates.codigo : produtoStub.codigo,
                              cnae: updates.cnae !== undefined ? updates.cnae : produtoStub.cnae,
                              discriminacao: updates.discriminacao !== undefined
                                ? updates.discriminacao
                                : produtoStub.discriminacao,
                              aliquota: updates.aliquota !== undefined ? updates.aliquota : produtoStub.aliquota,
                              valor_sugerido: updates.valor_sugerido !== undefined
                                ? updates.valor_sugerido
                                : produtoStub.valor_sugerido,
                              metadata_json: updates.metadata_json !== undefined
                                ? updates.metadata_json
                                : produtoStub.metadata_json,
                              dedupe_key: produtoStub.dedupe_key,
                              last_used_at: updates.last_used_at,
                              created_at: '2026-01-01T00:00:00.000Z',
                              updated_at: updates.updated_at
                            },
                            error: null
                          })
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
      throw new Error(`mock Supabase: tabela não suportada: ${table}`);
    }
  };

  return { client, userId, getLastClienteUpsertRow: () => lastClienteUpsertRow };
};

afterEach(async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__resetGetDbForTests();
});

test('criarCatalogoCliente rejeita sem nome', async () => {
  const { criarCatalogoCliente } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => criarCatalogoCliente('user-1', { documento: '12345678000199' }),
    (err) => err.status === 400 && /nome/.test(err.message)
  );
});

test('criarCatalogoCliente rejeita documento com tamanho inválido', async () => {
  const { criarCatalogoCliente } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => criarCatalogoCliente('user-1', { nome: 'Acme', documento: '123' }),
    (err) => err.status === 400 && /11 dígitos|14 dígitos|CPF|CNPJ/.test(err.message)
  );
});

test('criarCatalogoCliente rejeita e-mail inválido', async () => {
  const { criarCatalogoCliente } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => criarCatalogoCliente('user-1', {
      nome: 'Acme',
      documento: '12345678000199',
      email: 'nao-e-email'
    }),
    (err) => err.status === 400 && /e-mail/.test(err.message)
  );
});

test('atualizarCatalogoCliente rejeita PATCH com documento', async () => {
  const { atualizarCatalogoCliente } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => atualizarCatalogoCliente('user-1', '550e8400-e29b-41d4-a716-446655440000', {
      documento: '11111111000191'
    }),
    (err) => err.status === 400 && /documento|tipo de documento/.test(err.message)
  );
});

test('atualizarCatalogoCliente rejeita PATCH com dedupe_key', async () => {
  const { atualizarCatalogoCliente } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => atualizarCatalogoCliente('user-1', '550e8400-e29b-41d4-a716-446655440000', {
      dedupe_key: 'x'
    }),
    (err) => err.status === 400 && /dedupe_key/.test(err.message)
  );
});

test('criarCatalogoProduto rejeita sem discriminacao', async () => {
  const { criarCatalogoProduto } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => criarCatalogoProduto('user-1', { codigo: 'S1' }),
    (err) => err.status === 400 && /discriminacao/.test(err.message)
  );
});

test('atualizarCatalogoProduto rejeita alteração de dedupe_key', async () => {
  const { atualizarCatalogoProduto } = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => atualizarCatalogoProduto('user-1', '550e8400-e29b-41d4-a716-446655440000', {
      dedupe_key: 'manual:novo'
    }),
    (err) => err.status === 400 && /dedupe_key/.test(err.message)
  );
});

test('criarCatalogoCliente — sucesso com stub getDb (user_id e dedupe no upsert)', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  const out = await mod.criarCatalogoCliente(mock.userId, {
    nome: 'Empresa Feliz',
    documento: '12.345.678/0001-99',
    email: 'contato@exemplo.com'
  });

  assert.equal(out.nome, 'Empresa Feliz');
  assert.equal(out.documento, '12345678000199');
  const row = mock.getLastClienteUpsertRow();
  assert.ok(row);
  assert.equal(row.user_id, mock.userId);
  assert.equal(row.dedupe_key, 'doc:12345678000199');
});

test('criarCatalogoCliente — sucesso NFE (destinatario no payload interno)', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  const out = await mod.criarCatalogoCliente(mock.userId, {
    nome: 'Leonardo de Lima',
    documento: '11953257704',
    documentType: 'NFE',
  });

  assert.equal(out.nome, 'Leonardo de Lima');
  assert.equal(out.documento, '11953257704');
  const row = mock.getLastClienteUpsertRow();
  assert.ok(row);
  assert.equal(row.document_type, 'NFE');
  assert.equal(row.dedupe_key, 'doc:11953257704');
});

test('atualizarCatalogoCliente — sucesso PATCH nome com stub getDb', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  const out = await mod.atualizarCatalogoCliente(
    mock.userId,
    '550e8400-e29b-41d4-a716-446655440000',
    { nome: 'Novo Nome' }
  );
  assert.equal(out.nome, 'Novo Nome');
});

test('criarCatalogoProduto — rejeita duplicata mesmo código + CNAE', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  const origFrom = mock.client.from.bind(mock.client);
  mock.client.from = (table) => {
    if (table === PRODUCTS_TABLE) {
      const api = origFrom(table);
      const origSelect = api.select.bind(api);
      api.select = (...args) => {
        const chain = origSelect(...args);
        const origEq = chain.eq.bind(chain);
        let eqCount = 0;
        chain.eq = (...eqArgs) => {
          eqCount += 1;
          if (eqCount >= 2 && eqArgs[0] === 'user_id') {
            chain.then = (resolve) => resolve({
              data: [{
                id: 'dup-1',
                codigo: '140101',
                cnae: '4520001',
                discriminacao: 'Manutenção veículos',
                document_type: 'NFSE',
              }],
              error: null,
            });
          }
          return origEq(...eqArgs);
        };
        return chain;
      };
      return api;
    }
    return origFrom(table);
  };

  await assert.rejects(
    () => mod.criarCatalogoProduto(mock.userId, {
      discriminacao: 'Outra descrição longa',
      codigo: '14.01.01',
      cnae: '4520-0/01',
    }),
    (err) => /Já existe serviço/.test(String(err?.message || '')),
  );
});

test('criarCatalogoProduto — sucesso com stub getDb (user_id e dedupe_key manual:)', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  let insertedRow = null;
  const origFrom = mock.client.from.bind(mock.client);
  mock.client.from = (table) => {
    if (table === PRODUCTS_TABLE) {
      const api = origFrom(table);
      const ins = api.insert.bind(api);
      api.insert = (row) => {
        insertedRow = row;
        return ins(row);
      };
      return api;
    }
    return origFrom(table);
  };

  const out = await mod.criarCatalogoProduto(mock.userId, {
    discriminacao: 'Consultoria',
    codigo: 'C01'
  });
  assert.equal(out.discriminacao, 'Consultoria');
  assert.ok(insertedRow);
  assert.equal(insertedRow.user_id, mock.userId);
  assert.match(insertedRow.dedupe_key, /^manual:[0-9a-f-]{36}$/i);
});

test('atualizarCatalogoProduto — sucesso PATCH discriminacao com stub getDb', async () => {
  const mock = createCatalogSupabaseMock();
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock.client);

  const out = await mod.atualizarCatalogoProduto(
    mock.userId,
    '660e8400-e29b-41d4-a716-446655440001',
    { discriminacao: 'Serviço revisado' }
  );
  assert.equal(out.discriminacao, 'Serviço revisado');
});

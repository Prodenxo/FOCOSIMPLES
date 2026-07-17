import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const CLIENTS_TABLE = 'mei_nfse_clientes';
const PRODUCTS_TABLE = 'mei_nfse_produtos';

/**
 * Mock Supabase para fluxos delete + lookup opcional por id.
 * @param {'cliente'|'produto'} kind
 * @param {{ userId: string, recordId: string, lookupRow?: { id: string, user_id: string } | null, deleteOnce?: boolean }} opts
 */
function createDeleteMock(kind, opts) {
  const table = kind === 'cliente' ? CLIENTS_TABLE : PRODUCTS_TABLE;
  const { userId, recordId, lookupRow = null, deleteOnce = false } = opts;
  let alreadyGone = !deleteOnce;

  return {
    from(t) {
      assert.equal(t, table);
      return {
        delete() {
          return {
            eq(c1, v1) {
              assert.equal(c1, 'id');
              assert.equal(v1, recordId);
              return {
                eq(c2, v2) {
                  assert.equal(c2, 'user_id');
                  assert.equal(v2, userId);
                  return {
                    select() {
                      return Promise.resolve(
                        !alreadyGone
                          ? (alreadyGone = true, { data: [{ id: recordId }], error: null })
                          : { data: [], error: null }
                      );
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
              assert.equal(c1, 'id');
              assert.equal(v1, recordId);
              return {
                maybeSingle() {
                  return Promise.resolve({ data: lookupRow, error: null });
                }
              };
            }
          };
        }
      };
    }
  };
}

afterEach(async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__resetGetDbForTests();
});

test('eliminarCatalogoCliente — sucesso (uma linha removida)', async () => {
  const userId = 'user-happy-1';
  const recordId = '550e8400-e29b-41d4-a716-446655440000';
  const mock = createDeleteMock('cliente', { userId, recordId, deleteOnce: true });
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock);

  await mod.eliminarCatalogoCliente(userId, recordId);
});

test('eliminarCatalogoCliente — idempotente (segundo delete sem lookup conflituoso)', async () => {
  const userId = 'user-happy-1';
  const recordId = '550e8400-e29b-41d4-a716-446655440000';
  const mock = createDeleteMock('cliente', { userId, recordId, deleteOnce: true });
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock);

  await mod.eliminarCatalogoCliente(userId, recordId);
  const mock2 = createDeleteMock('cliente', {
    userId,
    recordId,
    deleteOnce: false,
    lookupRow: null
  });
  mod.__setGetDbForTests(() => mock2);
  await mod.eliminarCatalogoCliente(userId, recordId);
});

test('eliminarCatalogoCliente — 404 se id pertence a outro utilizador', async () => {
  const userId = 'user-happy-1';
  const recordId = '550e8400-e29b-41d4-a716-446655440000';
  const mock = createDeleteMock('cliente', {
    userId,
    recordId,
    deleteOnce: false,
    lookupRow: { id: recordId, user_id: 'outro-user' }
  });
  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() => mock);

  await assert.rejects(
    () => mod.eliminarCatalogoCliente(userId, recordId),
    (err) => err.status === 404 && /não encontrado/.test(err.message)
  );
});

test('eliminarCatalogoCliente — 400 id inválido', async () => {
  const mod = await import('../src/services/mei-notas.service.js');
  await assert.rejects(
    () => mod.eliminarCatalogoCliente('user-1', 'não-uuid'),
    (err) => err.status === 400 && /inválido/.test(err.message)
  );
});

test('eliminarCatalogoProduto — sucesso e 404 outro dono', async () => {
  const userId = 'user-happy-1';
  const recordId = '660e8400-e29b-41d4-a716-446655440001';

  const mod = await import('../src/services/mei-notas.service.js');
  mod.__setGetDbForTests(() =>
    createDeleteMock('produto', { userId, recordId, deleteOnce: true })
  );
  await mod.eliminarCatalogoProduto(userId, recordId);

  mod.__setGetDbForTests(() =>
    createDeleteMock('produto', {
      userId,
      recordId,
      deleteOnce: false,
      lookupRow: { id: recordId, user_id: 'outro' }
    })
  );
  await assert.rejects(
    () => mod.eliminarCatalogoProduto(userId, recordId),
    (err) => err.status === 404
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureGlobalCategoriesCopiedForUser } from '../src/services/categories.service.js';

const makeDbClient = ({ globals = [], existing = [], inserted = [] } = {}) => {
  const budgets = [];
  return {
    budgets,
    from(table) {
      if (table === 'categorias_id') {
        let mode = 'globals';
        const api = {
          select() { return api; },
          is() { mode = 'globals'; return api; },
          eq(_col, val) {
            mode = val ? 'existing' : 'globals';
            return api;
          },
          in() { return api; },
          insert(rows) {
            const list = Array.isArray(rows) ? rows : [rows];
            inserted.push(...list);
            return {
              select() {
                return Promise.resolve({
                  data: list.map((row, index) => ({ id: 1000 + index, ...row })),
                  error: null,
                });
              },
            };
          },
          then(resolve, reject) {
            if (mode === 'globals') {
              return Promise.resolve({ data: globals, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: existing, error: null }).then(resolve, reject);
          },
        };
        return api;
      }
      if (table === 'orçamentos') {
        const api = {
          select() { return api; },
          eq() { return api; },
          in() { return api; },
          insert(rows) {
            budgets.push(...(Array.isArray(rows) ? rows : [rows]));
            return Promise.resolve({ error: null });
          },
          then(resolve) {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
        return api;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
};

test('ensureGlobalCategoriesCopiedForUser copia globais ausentes', async () => {
  const inserted = [];
  const db = makeDbClient({
    globals: [{ nome: 'Alimentação', tipo: 'saida' }],
    existing: [],
    inserted,
  });

  const result = await ensureGlobalCategoriesCopiedForUser(db, 'user-1');
  assert.equal(result.inserted, 1);
  assert.equal(result.budgetRows, 1);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].user_id, 'user-1');
  assert.equal(inserted[0].nome, 'Alimentação');
});

test('ensureGlobalCategoriesCopiedForUser é idempotente', async () => {
  const inserted = [];
  const db = makeDbClient({
    globals: [{ nome: 'Salário', tipo: 'entrada' }],
    existing: [{ id: 5, nome: 'Salário', tipo: 'entrada' }],
    inserted,
  });

  const result = await ensureGlobalCategoriesCopiedForUser(db, 'user-2');
  assert.equal(result.inserted, 0);
  assert.equal(inserted.length, 0);
});

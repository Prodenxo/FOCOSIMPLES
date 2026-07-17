import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const matchesFilter = (row, [op, field, val]) => {
  const v = row[field];
  if (op === 'eq') return v === val;
  if (op === 'is') return val === null ? v == null : v === val;
  if (op === 'in') return Array.isArray(val) && val.includes(v);
  if (op === 'gte') return String(v) >= String(val);
  if (op === 'lte') return String(v) <= String(val);
  return true;
};

const matchesAll = (row, filters) => filters.every((f) => matchesFilter(row, f));

/**
 * Mock mínimo das cadeias Supabase usadas por listCategoryBudgetsSummary e listCategoryBudgetsDreMatrix.
 */
const createBudgetParitySupabaseMock = (fixture) => {
  const { userId, userCategories, globalCategories, budgets, saidas, entradasRecebidas } = fixture;

  const execute = (state) => {
    const { table, filters } = state;
    let rows = [];

    if (table === 'categorias_id') {
      const pool = [...userCategories, ...globalCategories];
      rows = pool.filter((r) => matchesAll(r, filters));
    } else if (table === 'orçamentos') {
      const pool = budgets.filter((b) => b.user_id === userId);
      rows = pool.filter((r) => matchesAll(r, filters));
    } else if (table === 'lancamentos_id') {
      const isEntradaRecebida = filters.some(
        ([op, f, val]) => op === 'eq' && f === 'status' && val === 'recebido'
      );
      const pool = isEntradaRecebida
        ? entradasRecebidas.filter((r) => r.user_id === userId)
        : saidas.filter((r) => r.user_id === userId);
      rows = pool.filter((r) => matchesAll(r, filters));
    }

    return { data: rows, error: null };
  };

  const from = (table) => {
    const state = { table, filters: [] };
    const chain = {
      select() {
        return chain;
      },
      eq(field, val) {
        state.filters.push(['eq', field, val]);
        return chain;
      },
      is(field, val) {
        state.filters.push(['is', field, val]);
        return chain;
      },
      gte(field, val) {
        state.filters.push(['gte', field, val]);
        return chain;
      },
      lte(field, val) {
        state.filters.push(['lte', field, val]);
        return chain;
      },
      in(field, vals) {
        state.filters.push(['in', field, vals]);
        return chain;
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(execute(state)).then(onFulfilled, onRejected);
      }
    };
    return chain;
  };

  return { from };
};

const assertMatrixMonthMatchesSummary = (summaryRows, matrixCellsForMonth, label) => {
  const byId = new Map(matrixCellsForMonth.map((c) => [c.categorias_id, c]));

  for (const s of summaryRows) {
    const cell = byId.get(s.categorias_id);
    if (cell) {
      assert.equal(cell.valor_orcado, s.valor_orcado, `${label} categorias_id=${s.categorias_id} valor_orcado`);
      assert.equal(cell.valor_gasto, s.valor_gasto, `${label} categorias_id=${s.categorias_id} valor_gasto`);
      assert.equal(
        cell.valor_recebido,
        s.valor_recebido,
        `${label} categorias_id=${s.categorias_id} valor_recebido`
      );
    } else {
      assert.equal(s.valor_gasto, 0, `${label} sem célula na matriz: gasto deve ser 0 (id=${s.categorias_id})`);
      assert.equal(
        s.valor_recebido,
        0,
        `${label} sem célula na matriz: recebido deve ser 0 (id=${s.categorias_id})`
      );
      assert.equal(
        s.valor_orcado,
        null,
        `${label} sem célula na matriz: orçamento inexistente (id=${s.categorias_id})`
      );
    }
  }

  for (const cell of matrixCellsForMonth) {
    const s = summaryRows.find((r) => r.categorias_id === cell.categorias_id);
    assert.ok(s, `${label}: célula da matriz deve existir no summary (id=${cell.categorias_id})`);
  }
};

test('paridade matriz (mês) vs listCategoryBudgetsSummary — março e julho (mock Supabase)', async (t) => {
  const USER_ID = 'parity-user-1';
  const YEAR = 2025;

  const fixture = {
    userId: USER_ID,
    userCategories: [
      { id: 101, nome: 'Alimentação', tipo: 'saida', user_id: USER_ID },
      { id: 102, nome: 'Sem movimento', tipo: 'saida', user_id: USER_ID },
      { id: 201, nome: 'Salário', tipo: 'entrada', user_id: USER_ID }
    ],
    globalCategories: [{ id: 1, nome: 'Global receita', tipo: 'entrada', user_id: null }],
    budgets: [
      { user_id: USER_ID, categorias_id: 101, valor_orçado: 500, date: '2025-03-01' },
      { user_id: USER_ID, categorias_id: 101, valor_orçado: 700, date: '2025-07-01' },
      { user_id: USER_ID, categorias_id: 102, valor_orçado: null, date: '2025-03-01' }
    ],
    saidas: [
      { user_id: USER_ID, classificacao: 'Alimentação', valor: 100, tipo: 'saida', data: '2025-03-10' },
      { user_id: USER_ID, classificacao: 'Alimentação', valor: 200, tipo: 'saída', data: '2025-07-15' }
    ],
    entradasRecebidas: [
      {
        user_id: USER_ID,
        classificacao: 'Salário',
        valor: 1000,
        tipo: 'entrada',
        data: '2025-03-05',
        status: 'recebido'
      },
      {
        user_id: USER_ID,
        classificacao: 'Salário',
        valor: 500,
        tipo: 'entrada',
        data: '2025-07-20',
        status: 'recebido'
      },
      {
        user_id: USER_ID,
        classificacao: 'Global receita',
        valor: 50,
        tipo: 'entrada',
        data: '2025-07-01',
        status: 'recebido'
      }
    ]
  };

  const {
    listCategoryBudgetsSummary,
    listCategoryBudgetsDreMatrix,
    __setCategoriesBudgetReadClientForTests
  } = await import('../src/services/categories.service.js');

  const restore = __setCategoriesBudgetReadClientForTests(() =>
    createBudgetParitySupabaseMock(fixture)
  );
  t.after(restore);

  const matrix = await listCategoryBudgetsDreMatrix(USER_ID, YEAR);

  for (const month of [3, 7]) {
    const summary = await listCategoryBudgetsSummary(USER_ID, { year: YEAR, month });
    const slice = matrix.filter((c) => c.month === month);
    assertMatrixMonthMatchesSummary(summary, slice, `year=${YEAR} month=${month}`);
  }
});

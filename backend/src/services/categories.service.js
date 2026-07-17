import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';

/** Cliente Supabase (service role) para leituras de orçamentos/resumo DRE; substituível em testes de paridade. */
let getCategoriesBudgetReadClient = () => createSupabaseClient({ useServiceRole: true });

export const __setCategoriesBudgetReadClientForTests = (fn) => {
  const prev = getCategoriesBudgetReadClient;
  getCategoriesBudgetReadClient = fn;
  return () => {
    getCategoriesBudgetReadClient = prev;
  };
};

const normalizeTipo = (tipo) => {
  if (!tipo) return tipo;
  return tipo === 'saída' ? 'saida' : tipo;
};

const normalizeCategoryName = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const categoryCopyKey = (nome, tipo) =>
  `${normalizeCategoryName(nome)}:${normalizeTipo(tipo) || ''}`;

/**
 * Garante cópias das categorias globais (user_id IS NULL) para o utilizador.
 * Idempotente — alinhado à migração copy_global_categories_to_users + RLS categorias_select_own.
 */
export const ensureGlobalCategoriesCopiedForUser = async (dbClient, userId) => {
  if (!userId) return { inserted: 0, budgetRows: 0 };

  const { data: globals, error: globalError } = await dbClient
    .from('categorias_id')
    .select('nome, tipo')
    .is('user_id', null);

  if (globalError) throw badRequest(globalError.message);
  if (!globals?.length) return { inserted: 0, budgetRows: 0 };

  const { data: existing, error: existingError } = await dbClient
    .from('categorias_id')
    .select('id, nome, tipo')
    .eq('user_id', userId);

  if (existingError) throw badRequest(existingError.message);

  const existingKeys = new Set(
    (existing || []).map((row) => categoryCopyKey(row.nome, row.tipo)),
  );

  const toInsert = (globals || [])
    .filter((row) => !existingKeys.has(categoryCopyKey(row.nome, row.tipo)))
    .map((row) => ({
      user_id: userId,
      nome: row.nome,
      tipo: normalizeTipo(row.tipo),
    }));

  if (!toInsert.length) return { inserted: 0, budgetRows: 0 };

  const { data: insertedRows, error: insertError } = await dbClient
    .from('categorias_id')
    .insert(toInsert)
    .select('id');

  if (insertError) throw badRequest(insertError.message);

  const monthStart = getMonthStartDateString();
  const newIds = (insertedRows || []).map((row) => row.id).filter(Boolean);
  let budgetRows = 0;

  if (newIds.length > 0) {
    const { data: existingBudgets, error: budgetReadError } = await dbClient
      .from('orçamentos')
      .select('categorias_id')
      .eq('user_id', userId)
      .eq('date', monthStart)
      .in('categorias_id', newIds);

    if (budgetReadError) throw badRequest(budgetReadError.message);

    const budgetedIds = new Set((existingBudgets || []).map((row) => row.categorias_id));
    const budgetInserts = newIds
      .filter((id) => !budgetedIds.has(id))
      .map((categorias_id) => ({
        user_id: userId,
        categorias_id,
        date: monthStart,
        'valor_orçado': null,
      }));

    if (budgetInserts.length > 0) {
      const { error: budgetInsertError } = await dbClient
        .from('orçamentos')
        .insert(budgetInserts);
      if (budgetInsertError) throw badRequest(budgetInsertError.message);
      budgetRows = budgetInserts.length;
    }
  }

  return { inserted: toInsert.length, budgetRows };
};

const parseValorOrcado = (valorOrcado) => {
  if (valorOrcado === null || valorOrcado === undefined || valorOrcado === '') return null;
  const parsed = Number(String(valorOrcado).replace(',', '.'));
  if (Number.isNaN(parsed)) throw badRequest('Valor do orçamento inválido');
  return parsed;
};

const getMonthStartDateString = (date = new Date()) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return monthStart.toISOString().split('T')[0];
};

const ensureMonthlyBudgets = async (dbClient, userId, targetDate = new Date()) => {
  const currentMonthStart = getMonthStartDateString(targetDate);
  const previousMonthStart = getMonthStartDateString(
    new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)
  );

  const { data: currentBudgets, error: currentError } = await dbClient
    .from('orçamentos')
    .select('categorias_id')
    .eq('user_id', userId)
    .eq('date', currentMonthStart);

  if (currentError) throw badRequest(currentError.message);

  const existingIds = new Set((currentBudgets || []).map((item) => item.categorias_id));

  const { data: lastMonthBudgets, error: lastMonthError } = await dbClient
    .from('orçamentos')
    .select('categorias_id')
    .eq('user_id', userId)
    .eq('date', previousMonthStart)
    .not('valor_orçado', 'is', null);

  if (lastMonthError) throw badRequest(lastMonthError.message);

  const toInsert = (lastMonthBudgets || [])
    .filter((budget) => !existingIds.has(budget.categorias_id))
    .map((budget) => ({
      user_id: userId,
      categorias_id: budget.categorias_id,
      date: currentMonthStart,
      'valor_orçado': null
    }));

  if (toInsert.length > 0) {
    const { error: insertError } = await dbClient
      .from('orçamentos')
      .insert(toInsert);

    if (insertError) throw badRequest(insertError.message);
  }

  return currentMonthStart;
};

const getYearMonthRange = (year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];
  return { startDate, endDate };
};

const getMonthRangeFromInput = (year, month) => {
  if (!year || !month || Number.isNaN(Number(year)) || Number.isNaN(Number(month))) {
    return null;
  }
  if (month < 1 || month > 12) {
    throw badRequest('Mês inválido');
  }
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];
  return { startDate, endDate, start };
};

/** Mês civil 1–12 a partir de `data` em lançamento (YYYY-MM-DD ou ISO). */
export const parseMonthFromLancamentoDate = (dataValue) => {
  if (!dataValue) return null;
  const s = String(dataValue);
  const ymd = s.length >= 10 ? s.slice(0, 10) : s;
  const parts = ymd.split('-');
  if (parts.length < 2) return null;
  const month = Number.parseInt(parts[1], 10);
  if (Number.isNaN(month) || month < 1 || month > 12) return null;
  return month;
};

/** Mês civil 1–12 a partir de `date` de linha em orçamentos (início do mês). */
export const parseMonthFromBudgetDate = (dateValue) => {
  if (!dateValue) return null;
  const s = String(dateValue);
  const ymd = s.length >= 10 ? s.slice(0, 10) : s;
  const parts = ymd.split('-');
  if (parts.length < 2) return null;
  const month = Number.parseInt(parts[1], 10);
  if (Number.isNaN(month) || month < 1 || month > 12) return null;
  return month;
};

const ensureUserCategory = async (dbClient, userId, categoriaId) => {
  await ensureGlobalCategoriesCopiedForUser(dbClient, userId);
  const { data, error } = await dbClient
    .from('categorias_id')
    .select('id, user_id')
    .eq('id', categoriaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data) throw badRequest('Categoria inválida para o usuário');
};

export const listCategories = async (userId, tipo) => {
  const dbClient = createSupabaseClient({ useServiceRole: true });
  await ensureGlobalCategoriesCopiedForUser(dbClient, userId);

  const { data: categories, error } = await dbClient
    .from('categorias_id')
    .select('id, nome, tipo, user_id')
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);

  let allCategories = categories || [];

  if (tipo) {
    const tipoNormalizado = normalizeTipo(tipo);
    const tiposAceitos = tipoNormalizado === 'saida'
      ? ['saida', 'saída']
      : [tipoNormalizado];
    allCategories = allCategories.filter((cat) => tiposAceitos.includes(cat.tipo));
  }

  return allCategories.sort((a, b) => a.nome.localeCompare(b.nome));
};

/**
 * Lista mínima para integrações (somente identificadores visíveis ao utilizador).
 * @param {{ id: number, nome: string }[]} rows
 * @returns {{ id: number, nome: string }[]}
 */
export const mapCategoriesToMinimalRows = (rows) =>
  (rows || []).map(({ id, nome }) => ({ id, nome }));

export const createCategory = async (userId, payload) => {
  const { nome, tipo } = payload || {};
  if (!nome || !tipo) throw badRequest('Nome e tipo são obrigatórios');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from('categorias_id')
    .insert({ nome, tipo: normalizeTipo(tipo), user_id: userId })
    .select()
    .single();

  if (error) throw badRequest(error.message);

  const monthStart = getMonthStartDateString();
  const { error: budgetError } = await dbClient
    .from('orçamentos')
    .insert({
      user_id: userId,
      categorias_id: data.id,
      date: monthStart,
      'valor_orçado': null
    });

  if (budgetError) throw badRequest(budgetError.message);
  return data;
};

export const updateCategory = async (userId, payload) => {
  const { id, ...updates } = payload || {};
  if (!id) throw badRequest('ID da categoria é obrigatório');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from('categorias_id')
    .update({
      ...updates,
      ...(updates.tipo ? { tipo: normalizeTipo(updates.tipo) } : {})
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const deleteCategory = async (userId, body, query) => {
  const idFromQuery = query?.id ? Number(query.id) : null;
  const idFromBody = body?.id ? Number(body.id) : null;
  const id = idFromQuery || idFromBody;

  if (!id) throw badRequest('ID da categoria é obrigatório');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { error } = await dbClient
    .from('categorias_id')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);
};

export const listCategoryBudgets = async (userId) => {
  const dbClient = createSupabaseClient({ useServiceRole: true });
  const currentMonthStart = await ensureMonthlyBudgets(dbClient, userId);
  const { data, error } = await dbClient
    .from('orçamentos')
    .select('categorias_id, valor_orçado')
    .eq('user_id', userId)
    .eq('date', currentMonthStart);

  if (error) throw badRequest(error.message);
  return data || [];
};

export const upsertCategoryBudget = async (userId, payload) => {
  const { categorias_id: categoriasId, valor_orcado: valorOrcado, date } = payload || {};
  const categoriaId = Number(categoriasId);

  if (!categoriaId) throw badRequest('ID da categoria é obrigatório');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  await ensureUserCategory(dbClient, userId, categoriaId);

  const valorOrcadoNormalizado = parseValorOrcado(valorOrcado);
  const currentMonthStart = getMonthStartDateString(date ? new Date(date) : new Date());

  const { data: existing, error: existingError } = await dbClient
    .from('orçamentos')
    .select('id')
    .eq('user_id', userId)
    .eq('categorias_id', categoriaId)
    .eq('date', currentMonthStart)
    .maybeSingle();

  if (existingError) throw badRequest(existingError.message);

  if (existing?.id) {
    const { data, error } = await dbClient
      .from('orçamentos')
      .update({ 'valor_orçado': valorOrcadoNormalizado })
      .eq('id', existing.id)
      .select('categorias_id, valor_orçado')
      .single();

    if (error) throw badRequest(error.message);
    return data;
  }

  const { data, error } = await dbClient
    .from('orçamentos')
    .insert({
      user_id: userId,
      categorias_id: categoriaId,
      date: currentMonthStart,
      'valor_orçado': valorOrcadoNormalizado
    })
    .select('categorias_id, valor_orçado')
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const listCategoryBudgetsSummary = async (userId, { year, month } = {}) => {
  const dbClient = getCategoriesBudgetReadClient();
  await ensureGlobalCategoriesCopiedForUser(dbClient, userId);

  const { data: categories, error: catError } = await dbClient
    .from('categorias_id')
    .select('id, nome, tipo, user_id')
    .eq('user_id', userId);

  if (catError) throw badRequest(catError.message);

  const allCategories = categories || [];

  const range = getMonthRangeFromInput(year, month);
  const monthStartDate = range ? range.startDate : await ensureMonthlyBudgets(dbClient, userId);
  const { data: budgets, error: budgetsError } = await dbClient
    .from('orçamentos')
    .select('categorias_id, valor_orçado')
    .eq('user_id', userId)
    .eq('date', monthStartDate);

  if (budgetsError) throw badRequest(budgetsError.message);

  const startOfMonth = range?.startDate
    || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = range?.endDate
    || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: transactions, error: transactionsError } = await dbClient
    .from('lancamentos_id')
    .select('classificacao, valor, tipo, data')
    .eq('user_id', userId)
    .in('tipo', ['saida', 'saída'])
    .gte('data', startOfMonth)
    .lte('data', endOfMonth);

  if (transactionsError) throw badRequest(transactionsError.message);

  const spentByCategoryName = new Map();
  (transactions || []).forEach((transaction) => {
    if (!transaction?.classificacao) return;
    const key = normalizeCategoryName(transaction.classificacao);
    const current = spentByCategoryName.get(key) || 0;
    spentByCategoryName.set(key, current + Number(transaction.valor || 0));
  });

  const { data: receivedTransactions, error: receivedError } = await dbClient
    .from('lancamentos_id')
    .select('classificacao, valor, tipo, data, status')
    .eq('user_id', userId)
    .eq('status', 'recebido')
    .eq('tipo', 'entrada')
    .gte('data', startOfMonth)
    .lte('data', endOfMonth);

  if (receivedError) throw badRequest(receivedError.message);

  const receivedByCategoryName = new Map();
  (receivedTransactions || []).forEach((transaction) => {
    if (!transaction?.classificacao) return;
    const key = normalizeCategoryName(transaction.classificacao);
    const current = receivedByCategoryName.get(key) || 0;
    receivedByCategoryName.set(key, current + Number(transaction.valor || 0));
  });

  const budgetByCategoryId = new Map();
  (budgets || []).forEach((budget) => {
    budgetByCategoryId.set(budget.categorias_id, budget.valor_orçado ?? null);
  });

  return allCategories.map((categoria) => {
    const key = normalizeCategoryName(categoria.nome);
    return {
      categorias_id: categoria.id,
      valor_orcado: budgetByCategoryId.has(categoria.id) ? budgetByCategoryId.get(categoria.id) : null,
      valor_gasto: spentByCategoryName.get(key) || 0,
      valor_recebido: receivedByCategoryName.get(key) || 0
    };
  });
};

export const duplicateMonthlyBudgets = async (userId, { year, month }) => {
  const range = getMonthRangeFromInput(year, month);
  if (!range) throw badRequest('Ano e mês são obrigatórios');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const targetMonthStart = range.startDate;
  const previousMonthStart = getMonthStartDateString(
    new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1)
  );

  const { data: previousBudgets, error: previousError } = await dbClient
    .from('orçamentos')
    .select('categorias_id, valor_orçado')
    .eq('user_id', userId)
    .eq('date', previousMonthStart)
    .not('valor_orçado', 'is', null);

  if (previousError) throw badRequest(previousError.message);

  const { data: existingBudgets, error: existingError } = await dbClient
    .from('orçamentos')
    .select('id, categorias_id')
    .eq('user_id', userId)
    .eq('date', targetMonthStart);

  if (existingError) throw badRequest(existingError.message);

  const existingMap = new Map((existingBudgets || []).map((item) => [item.categorias_id, item.id]));

  const updates = (previousBudgets || []).filter((budget) => existingMap.has(budget.categorias_id));
  const inserts = (previousBudgets || []).filter((budget) => !existingMap.has(budget.categorias_id));

  await Promise.all(
    updates.map((budget) =>
      dbClient
        .from('orçamentos')
        .update({ 'valor_orçado': budget.valor_orçado })
        .eq('id', existingMap.get(budget.categorias_id))
    )
  );

  if (inserts.length > 0) {
    const rows = inserts.map((budget) => ({
      user_id: userId,
      categorias_id: budget.categorias_id,
      date: targetMonthStart,
      'valor_orçado': budget.valor_orçado
    }));
    const { error: insertError } = await dbClient
      .from('orçamentos')
      .insert(rows);

    if (insertError) throw badRequest(insertError.message);
  }

  return {
    targetMonthStart,
    duplicated: (previousBudgets || []).length
  };
};

export const listCategoryBudgetsYearly = async (userId, year) => {
  if (!year || Number.isNaN(Number(year))) {
    throw badRequest('Ano inválido');
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { startDate, endDate } = getYearMonthRange(year);

  const { data, error } = await dbClient
    .from('orçamentos')
    .select('categorias_id, valor_orçado, date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw badRequest(error.message);

  return (data || []).map((budget) => ({
    categorias_id: budget.categorias_id,
    valor_orcado: budget.valor_orçado ?? null,
    month: Number(String(budget.date).split('-')[1]) - 1
  }));
};

/**
 * Matriz orçado × realizado por categoria e mês (1–12) num ano.
 * Semântica alinhada a `listCategoryBudgetsSummary` por mês.
 * Células omitidas quando não há linha de orçamento naquele mês e gasto/recebido são 0.
 */
export const listCategoryBudgetsDreMatrix = async (userId, year) => {
  const y = Number(year);
  if (year === undefined || year === null || Number.isNaN(y)) {
    throw badRequest('Ano inválido');
  }
  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    throw badRequest('Ano inválido');
  }

  const dbClient = getCategoriesBudgetReadClient();
  const { startDate, endDate } = getYearMonthRange(y);
  await ensureGlobalCategoriesCopiedForUser(dbClient, userId);

  const { data: userCategories, error: userError } = await dbClient
    .from('categorias_id')
    .select('id, nome, tipo, user_id')
    .eq('user_id', userId);

  if (userError) throw badRequest(userError.message);

  const allCategories = userCategories || [];

  const { data: budgetRows, error: budgetsError } = await dbClient
    .from('orçamentos')
    .select('categorias_id, valor_orçado, date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (budgetsError) throw badRequest(budgetsError.message);

  const { data: transactions, error: transactionsError } = await dbClient
    .from('lancamentos_id')
    .select('classificacao, valor, tipo, data')
    .eq('user_id', userId)
    .in('tipo', ['saida', 'saída'])
    .gte('data', startDate)
    .lte('data', endDate);

  if (transactionsError) throw badRequest(transactionsError.message);

  const { data: receivedTransactions, error: receivedError } = await dbClient
    .from('lancamentos_id')
    .select('classificacao, valor, tipo, data, status')
    .eq('user_id', userId)
    .eq('status', 'recebido')
    .eq('tipo', 'entrada')
    .gte('data', startDate)
    .lte('data', endDate);

  if (receivedError) throw badRequest(receivedError.message);

  const budgetMap = new Map();
  (budgetRows || []).forEach((row) => {
    const month = parseMonthFromBudgetDate(row.date);
    if (!month) return;
    const key = `${row.categorias_id}_${month}`;
    budgetMap.set(key, row.valor_orçado ?? null);
  });

  const spentMap = new Map();
  (transactions || []).forEach((transaction) => {
    if (!transaction?.classificacao) return;
    const month = parseMonthFromLancamentoDate(transaction.data);
    if (!month) return;
    const nameKey = normalizeCategoryName(transaction.classificacao);
    const cellKey = `${nameKey}_${month}`;
    const current = spentMap.get(cellKey) || 0;
    spentMap.set(cellKey, current + Number(transaction.valor || 0));
  });

  const receivedMap = new Map();
  (receivedTransactions || []).forEach((transaction) => {
    if (!transaction?.classificacao) return;
    const month = parseMonthFromLancamentoDate(transaction.data);
    if (!month) return;
    const nameKey = normalizeCategoryName(transaction.classificacao);
    const cellKey = `${nameKey}_${month}`;
    const current = receivedMap.get(cellKey) || 0;
    receivedMap.set(cellKey, current + Number(transaction.valor || 0));
  });

  const results = [];
  for (const categoria of allCategories) {
    const nomeKey = normalizeCategoryName(categoria.nome);
    for (let month = 1; month <= 12; month += 1) {
      const budgetKey = `${categoria.id}_${month}`;
      const hasBudget = budgetMap.has(budgetKey);
      const valorOrcado = hasBudget ? budgetMap.get(budgetKey) : null;
      const valorGasto = spentMap.get(`${nomeKey}_${month}`) || 0;
      const valorRecebido = receivedMap.get(`${nomeKey}_${month}`) || 0;

      const include =
        hasBudget || valorGasto !== 0 || valorRecebido !== 0;
      if (!include) continue;

      results.push({
        categorias_id: categoria.id,
        month,
        valor_orcado: valorOrcado,
        valor_gasto: valorGasto,
        valor_recebido: valorRecebido
      });
    }
  }

  return results;
};

import { supabase } from './supabase';
import { apiClient } from './apiClient';
import { getMeiApiBaseUrl } from './runtimeEnv';

/** Tabela `orçamentos`: literal unicode quebra inferência do gerador de tipos do Supabase. */
const orcamentos = () => (supabase as any).from('orçamentos');

export type CategoryBudgetSummary = {
  categorias_id: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
};

export type DreMatrixCell = {
  categorias_id: number;
  month: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
};

export type UserCategory = {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
};

/** Lista categorias do utilizador (garante cópia das globais via API quando disponível). */
export async function fetchUserCategories(userId: string): Promise<UserCategory[]> {
  if (getMeiApiBaseUrl()) {
    const data = await apiClient.get<UserCategory[]>('/categories');
    return data || [];
  }

  const { data, error } = await supabase
    .from('categorias_id')
    .select('id, nome, tipo, user_id')
    .eq('user_id', userId)
    .order('nome');

  if (error) throw error;
  return (data || []) as UserCategory[];
}

type MonthParams = {
  year: number;
  month: number; // 1-12
};

const pad2 = (value: number) => String(value).padStart(2, '0');
const normalizeCategoryKey = (nome: string) => String(nome || '').trim().toLowerCase();

const getMonthStart = ({ year, month }: MonthParams) => `${year}-${pad2(month)}-01`;

const getMonthRange = ({ year, month }: MonthParams) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startOfMonth: start.toISOString().split('T')[0],
    endOfMonth: end.toISOString().split('T')[0],
  };
};

const getPrevMonth = ({ year, month }: MonthParams): MonthParams => {
  const prev = new Date(year, month - 2, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
};

const fetchCategoriesMap = async (userId: string) => {
  const { data, error } = await supabase
    .from('categorias_id')
    .select('id, nome, tipo')
    .eq('user_id', userId);

  if (error || !data) {
    return {
      nameById: {} as Record<string, string>,
      typeById: {} as Record<string, 'entrada' | 'saida'>,
      idByName: {} as Record<string, string>,
    };
  }

  const nameById: Record<string, string> = {};
  const typeById: Record<string, 'entrada' | 'saida'> = {};
  const idByName: Record<string, string> = {};
  data.forEach((cat: any) => {
    const id = String(cat.id || '');
    const nome = String(cat.nome || '');
    const tipoRaw = String(cat.tipo || '').toLowerCase().trim();
    const tipo = tipoRaw === 'entrada' ? 'entrada' : 'saida';
    if (id) {
      nameById[id] = nome;
      typeById[id] = tipo;
    }
    if (nome) {
      idByName[normalizeCategoryKey(nome)] = id;
    }
  });

  return { nameById, typeById, idByName };
};

const ensureMonthlyBudgets = async (userId: string, monthParams: MonthParams) => {
  const currentMonthStart = getMonthStart(monthParams);
  const prevMonthStart = getMonthStart(getPrevMonth(monthParams));

  const { data: legacyRows } = await orcamentos()
    .select('id')
    .is('date', null)
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (legacyRows && legacyRows.length > 0) {
    const legacyIds = legacyRows.map((row: any) => row.id).filter(Boolean);
    if (legacyIds.length > 0) {
      await orcamentos().update({ date: currentMonthStart }).in('id', legacyIds);
    }
  }

  const { data: currentRows } = await orcamentos()
    .select('id, categorias_id, user_id')
    .eq('date', currentMonthStart)
    .or(`user_id.eq.${userId},user_id.is.null`);

  const { data: prevRows } = await orcamentos()
    .select('categorias_id, user_id')
    .eq('date', prevMonthStart)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .not('valor_orçado', 'is', null);

  const existingKeys = new Set<string>();
  (currentRows || []).forEach((row: any) => {
    if (!row?.categorias_id) return;
    const key = `${row.categorias_id}:${row.user_id ?? 'null'}`;
    existingKeys.add(key);
  });

  const inserts: { categorias_id: number; user_id: string | null; valor_orçado: null; date: string }[] = [];
  (prevRows || []).forEach((row: any) => {
    const categoriasId = Number(row?.categorias_id);
    if (!categoriasId) return;
    const userKey = row?.user_id ?? null;
    const key = `${categoriasId}:${userKey ?? 'null'}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    inserts.push({
      categorias_id: categoriasId,
      user_id: userKey,
      valor_orçado: null,
      date: currentMonthStart,
    });
  });

  if (inserts.length > 0) {
    await orcamentos().insert(inserts);
  }
};

export async function fetchCategoryBudgetsSummary(
  userId: string,
  monthParams: MonthParams
): Promise<CategoryBudgetSummary[]> {
  await ensureMonthlyBudgets(userId, monthParams);

  const currentMonthStart = getMonthStart(monthParams);
  const { startOfMonth, endOfMonth } = getMonthRange(monthParams);
  const { idByName } = await fetchCategoriesMap(userId);

  const [
    { data: budgetRows, error: budgetError },
    { data: spentRows, error: spentError },
    { data: receivedRows, error: receivedError },
  ] = await Promise.all([
    orcamentos()
      .select('categorias_id, valor_orçado, user_id')
      .eq('date', currentMonthStart)
      .or(`user_id.eq.${userId},user_id.is.null`),
    supabase
      .from('lancamentos_id')
      .select('classificacao, valor, tipo, data')
      .eq('user_id', userId)
      .in('tipo', ['saida', 'saída'])
      .gte('data', startOfMonth)
      .lte('data', endOfMonth),
    supabase
      .from('lancamentos_id')
      .select('classificacao, valor, tipo, data, status')
      .eq('user_id', userId)
      .eq('status', 'recebido')
      .eq('tipo', 'entrada')
      .gte('data', startOfMonth)
      .lte('data', endOfMonth),
  ]);

  if (budgetError || spentError || receivedError) {
    return [];
  }

  const summaryById: Record<string, CategoryBudgetSummary> = {};

  (budgetRows || []).forEach((row: any) => {
    const catId = Number(row.categorias_id);
    if (!catId) return;
    const rowUserId = row.user_id ?? null;
    const existing = summaryById[String(catId)];
    if (existing && rowUserId !== userId) {
      return;
    }
    const valorOrcado = row['valor_orçado'];
    summaryById[String(catId)] = {
      categorias_id: catId,
      valor_orcado:
        typeof valorOrcado === 'number'
          ? valorOrcado
          : valorOrcado === null || typeof valorOrcado === 'undefined'
          ? null
          : Number(valorOrcado),
      valor_gasto: 0,
      valor_recebido: 0,
    };
  });

  (spentRows || []).forEach((row: any) => {
    const key = normalizeCategoryKey(String(row?.classificacao || ''));
    const catId = idByName[key];
    if (!catId) return;
    if (!summaryById[catId]) {
      summaryById[catId] = {
        categorias_id: Number(catId),
        valor_orcado: null,
        valor_gasto: 0,
        valor_recebido: 0,
      };
    }
    summaryById[catId].valor_gasto += Number(row.valor || 0);
  });

  (receivedRows || []).forEach((row: any) => {
    const key = normalizeCategoryKey(String(row?.classificacao || ''));
    const catId = idByName[key];
    if (!catId) return;
    if (!summaryById[catId]) {
      summaryById[catId] = {
        categorias_id: Number(catId),
        valor_orcado: null,
        valor_gasto: 0,
        valor_recebido: 0,
      };
    }
    summaryById[catId].valor_recebido += Number(row.valor || 0);
  });

  return Object.values(summaryById);
}

const normalizeCatNameForMatrix = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const parseMonthFromIsoDate = (dateStr: string): number | null => {
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return null;
  const month = Number(parts[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
};

async function buildDreMatrixFromSupabase(userId: string, year: number): Promise<DreMatrixCell[]> {
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const [
    { data: userCategories },
    { data: budgetRows },
    { data: spentRows },
    { data: receivedRows },
  ] = await Promise.all([
    supabase.from('categorias_id').select('id, nome, tipo').eq('user_id', userId),
    orcamentos()
      .select('categorias_id, valor_orçado, date')
      .eq('user_id', userId)
      .gte('date', startOfYear)
      .lte('date', endOfYear),
    supabase
      .from('lancamentos_id')
      .select('classificacao, valor, tipo, data')
      .eq('user_id', userId)
      .in('tipo', ['saida', 'saída'])
      .gte('data', startOfYear)
      .lte('data', endOfYear),
    supabase
      .from('lancamentos_id')
      .select('classificacao, valor, tipo, data, status')
      .eq('user_id', userId)
      .eq('status', 'recebido')
      .eq('tipo', 'entrada')
      .gte('data', startOfYear)
      .lte('data', endOfYear),
  ]);

  const allCategories = userCategories || [];
  const budgetMap = new Map<string, number | null>();
  (budgetRows || []).forEach((row: { categorias_id?: number; valor_orçado?: number | null; date?: string }) => {
    const month = row.date ? parseMonthFromIsoDate(row.date) : null;
    if (!month || !row.categorias_id) return;
    budgetMap.set(`${row.categorias_id}_${month}`, row.valor_orçado ?? null);
  });

  const spentMap = new Map<string, number>();
  (spentRows || []).forEach((row: { classificacao?: string; valor?: number; data?: string }) => {
    const month = row.data ? parseMonthFromIsoDate(row.data) : null;
    if (!month) return;
    const key = `${normalizeCatNameForMatrix(String(row.classificacao || ''))}_${month}`;
    spentMap.set(key, (spentMap.get(key) || 0) + Number(row.valor || 0));
  });

  const receivedMap = new Map<string, number>();
  (receivedRows || []).forEach((row: { classificacao?: string; valor?: number; data?: string }) => {
    const month = row.data ? parseMonthFromIsoDate(row.data) : null;
    if (!month) return;
    const key = `${normalizeCatNameForMatrix(String(row.classificacao || ''))}_${month}`;
    receivedMap.set(key, (receivedMap.get(key) || 0) + Number(row.valor || 0));
  });

  const results: DreMatrixCell[] = [];
  for (const categoria of allCategories) {
    const nomeKey = normalizeCatNameForMatrix(String(categoria.nome || ''));
    for (let month = 1; month <= 12; month += 1) {
      const budgetKey = `${categoria.id}_${month}`;
      const hasBudget = budgetMap.has(budgetKey);
      const valorOrcado = hasBudget ? budgetMap.get(budgetKey) ?? null : null;
      const valorGasto = spentMap.get(`${nomeKey}_${month}`) || 0;
      const valorRecebido = receivedMap.get(`${nomeKey}_${month}`) || 0;
      if (!hasBudget && valorGasto === 0 && valorRecebido === 0) continue;
      results.push({
        categorias_id: Number(categoria.id),
        month,
        valor_orcado: valorOrcado,
        valor_gasto: valorGasto,
        valor_recebido: valorRecebido,
      });
    }
  }

  return results;
}

export async function fetchCategoryBudgetsDreMatrix(userId: string, year: number): Promise<DreMatrixCell[]> {
  if (getMeiApiBaseUrl()) {
    try {
      const data = await apiClient.get<DreMatrixCell[]>(`/categories/budgets/dre-matrix?year=${year}`);
      return data || [];
    } catch (error) {
      console.warn('dre-matrix via API falhou; usando Supabase.', error);
    }
  }
  return buildDreMatrixFromSupabase(userId, year);
}

export async function fetchCategoryBudgetsYearly(userId: string, year: number) {
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const { data: budgetRows, error } = await orcamentos()
    .select('categorias_id, valor_orçado, user_id, date')
    .gte('date', startOfYear)
    .lte('date', endOfYear)
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (error || !budgetRows) {
    return [];
  }

  return budgetRows;
}

export async function saveCategoryBudget(
  userId: string,
  categoriasId: number,
  valorOrcado: number | null,
  date: string
) {
  const { data: existing } = await orcamentos()
    .select('id')
    .eq('categorias_id', categoriasId)
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (existing?.id) {
    return orcamentos()
      .update({ valor_orçado: valorOrcado, date })
      .eq('id', existing.id)
      .eq('user_id', userId);
  }

  return orcamentos().insert({
    categorias_id: categoriasId,
    valor_orçado: valorOrcado,
    user_id: userId,
    date,
  });
}

/** Remove o planejamento do mês (`valor_orçado` → null); mantém a categoria e o realizado. */
export async function deleteCategoryBudget(
  userId: string,
  categoriasId: number,
  date: string
) {
  return saveCategoryBudget(userId, categoriasId, null, date);
}

export async function duplicateMonthlyBudgets(userId: string, year: number, month: number) {
  const monthParams = { year, month };
  await ensureMonthlyBudgets(userId, monthParams);

  const currentMonthStart = getMonthStart(monthParams);
  const prevMonthStart = getMonthStart(getPrevMonth(monthParams));

  const { data: currentRows } = await orcamentos()
    .select('id, categorias_id')
    .eq('date', currentMonthStart)
    .eq('user_id', userId);

  const { data: prevRows } = await orcamentos()
    .select('categorias_id, valor_orçado')
    .eq('date', prevMonthStart)
    .eq('user_id', userId)
    .not('valor_orçado', 'is', null);

  const currentByCategoryId: Record<number, string> = {};
  (currentRows || []).forEach((row: any) => {
    const catId = Number(row.categorias_id);
    if (catId) currentByCategoryId[catId] = String(row.id);
  });

  const inserts: { categorias_id: number; valor_orçado: number; user_id: string; date: string }[] = [];
  for (const row of prevRows || []) {
    const catId = Number(row?.categorias_id);
    if (!catId) continue;
    const valor = Number(row?.valor_orçado);
    if (Number.isNaN(valor)) continue;
    const existingId = currentByCategoryId[catId];
    if (existingId) {
      await orcamentos()
        .update({ valor_orçado: valor, date: currentMonthStart })
        .eq('id', existingId)
        .eq('user_id', userId);
    } else {
      inserts.push({
        categorias_id: catId,
        valor_orçado: valor,
        user_id: userId,
        date: currentMonthStart,
      });
    }
  }

  if (inserts.length > 0) {
    await orcamentos().insert(inserts);
  }
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getMonthStart, normalizeCategoryKey } from '../lib/dashboardUtils';
import { fetchCategoryBudgetsSummary as fetchBudgetsSummaryApi } from '../lib/categoryService';
import { isLocalApiAuthMode } from '../lib/authMode';
import { getMeiApiBaseUrl } from '../lib/runtimeEnv';

export type BudgetSummaryItem = {
  categorias_id: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
};

export function useDashboardBudgetSummary(
  userId: string | null,
  categoriasMap: Record<string, string>,
  selectedYearMonth: { year: number; month: number }
) {
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryItem[]>([]);

  const fetchCategoryBudgetsSummary = useCallback(async () => {
    if (!userId) {
      setBudgetSummary([]);
      return;
    }

    const { year, month } = selectedYearMonth;

    if (isLocalApiAuthMode() || getMeiApiBaseUrl()) {
      try {
        const data = await fetchBudgetsSummaryApi(userId, { year, month });
        setBudgetSummary(data || []);
      } catch {
        setBudgetSummary([]);
      }
      return;
    }

    const monthDate = new Date(year, month - 1, 1);
    const currentMonthStart = getMonthStart(monthDate);
    const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const [
      { data: budgetRows, error: budgetError },
      { data: spentRows, error: spentError },
      { data: receivedRows, error: receivedError },
    ] = await Promise.all([
      supabase
        .from('orçamentos')
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
      setBudgetSummary([]);
      return;
    }

    const nameToId: Record<string, string> = {};
    Object.entries(categoriasMap).forEach(([id, nome]) => {
      if (nome) nameToId[normalizeCategoryKey(nome)] = id;
    });

    const summaryById: Record<
      string,
      { categorias_id: number; valor_orcado: number | null; valor_gasto: number; valor_recebido: number }
    > = {};

    ((budgetRows || []) as unknown as Record<string, unknown>[]).forEach((row) => {
      const catId = Number(row.categorias_id);
      if (!catId) return;
      const valorOrcado = row['valor_orçado'];
      summaryById[String(catId)] = {
        categorias_id: catId,
        valor_orcado:
          typeof valorOrcado === 'number'
            ? valorOrcado
            : valorOrcado === null || valorOrcado === undefined
              ? null
              : Number(valorOrcado),
        valor_gasto: 0,
        valor_recebido: 0,
      };
    });

    (spentRows || []).forEach((row: { classificacao?: string; valor?: number }) => {
      const key = normalizeCategoryKey(String(row?.classificacao ?? ''));
      const catId = nameToId[key];
      if (!catId || !summaryById[catId]) return;
      summaryById[catId].valor_gasto += Number(row.valor ?? 0);
    });

    (receivedRows || []).forEach((row: { classificacao?: string; valor?: number }) => {
      const key = normalizeCategoryKey(String(row?.classificacao ?? ''));
      const catId = nameToId[key];
      if (!catId || !summaryById[catId]) return;
      summaryById[catId].valor_recebido += Number(row.valor ?? 0);
    });

    setBudgetSummary(Object.values(summaryById));
  }, [userId, categoriasMap, selectedYearMonth.year, selectedYearMonth.month]);

  useEffect(() => {
    fetchCategoryBudgetsSummary();
  }, [fetchCategoryBudgetsSummary]);

  return { budgetSummary, fetchCategoryBudgetsSummary };
}

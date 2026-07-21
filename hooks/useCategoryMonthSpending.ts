import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchCategoryBudgetsSummary,
  type CategoryBudgetSummary,
} from '../lib/categoryService';
import { normalizarTipo, normalizeCategoryKey } from '../lib/dashboardUtils';
import { apiClient } from '../lib/apiClient';
import { isLocalApiAuthMode } from '../lib/authMode';

export type MonthRef = { year: number; month: number };

export type CategoryTransactionLine = {
  id: string;
  data: string;
  valor: number;
  tipo: string;
  classificacao: string;
  status: string;
  obs?: string | null;
};

export type CategorySpendingRow = {
  id: number;
  nome: string;
  tipo: 'entrada' | 'saida';
  amount: number;
  transactions: CategoryTransactionLine[];
};

function getMonthRange({ year, month }: MonthRef) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startOfMonth: start.toISOString().split('T')[0],
    endOfMonth: end.toISOString().split('T')[0],
  };
}

function mapTxRows(rows: Record<string, unknown>[]): CategoryTransactionLine[] {
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    data: String(row.data ?? ''),
    valor: Number(row.valor ?? 0),
    tipo: String(row.tipo ?? ''),
    classificacao: String(row.classificacao ?? ''),
    status: String(row.status ?? ''),
    obs: row.obs != null ? String(row.obs) : null,
  }));
}

export function useCategoryMonthSpending(
  userId: string | null,
  monthRef: MonthRef
) {
  const [budgetSummary, setBudgetSummary] = useState<CategoryBudgetSummary[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<CategoryTransactionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setBudgetSummary([]);
      setMonthTransactions([]);
      setLoading(false);
      return;
    }

    const { startOfMonth, endOfMonth } = getMonthRange(monthRef);

    const summaryPromise = fetchCategoryBudgetsSummary(userId, monthRef).catch(() => []);

    let txRows: CategoryTransactionLine[] = [];
    if (isLocalApiAuthMode()) {
      try {
        const all = await apiClient.get<Record<string, unknown>[]>('/transactions');
        txRows = mapTxRows(
          (all || []).filter((row) => {
            const d = String(row.data ?? '');
            return d >= startOfMonth && d <= endOfMonth;
          }),
        );
      } catch {
        txRows = [];
      }
      const summary = await summaryPromise;
      setBudgetSummary(summary);
      setMonthTransactions(txRows);
      return;
    }

    const [summary, txResult] = await Promise.all([
      summaryPromise,
      supabase
        .from('lancamentos_id')
        .select('id, classificacao, valor, tipo, data, status, obs')
        .eq('user_id', userId)
        .gte('data', startOfMonth)
        .lte('data', endOfMonth)
        .order('data', { ascending: false }),
    ]);

    setBudgetSummary(summary);

    if (txResult.error || !txResult.data) {
      setMonthTransactions([]);
    } else {
      setMonthTransactions(mapTxRows(txResult.data as Record<string, unknown>[]));
    }
  }, [userId, monthRef.year, monthRef.month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const summaryByCategoryId = budgetSummary.reduce<Record<number, CategoryBudgetSummary>>(
    (acc, item) => {
      acc[item.categorias_id] = item;
      return acc;
    },
    {}
  );

  function transactionsForCategory(nome: string, tipo: 'entrada' | 'saida') {
    const key = normalizeCategoryKey(nome);
    return monthTransactions.filter((tx) => {
      if (normalizarTipo(tx.tipo) !== tipo) return false;
      return normalizeCategoryKey(tx.classificacao) === key;
    });
  }

  function amountForCategory(
    catId: number,
    nome: string,
    tipo: 'entrada' | 'saida'
  ): number {
    const summary = summaryByCategoryId[catId];
    if (tipo === 'entrada') {
      if (summary && summary.valor_recebido > 0) return summary.valor_recebido;
    } else if (summary && summary.valor_gasto > 0) {
      return summary.valor_gasto;
    }
    return transactionsForCategory(nome, tipo).reduce((sum, tx) => sum + tx.valor, 0);
  }

  function buildRows(
    categorias: { id: number; nome: string; tipo: string }[],
    viewTipo: 'entrada' | 'saida'
  ): CategorySpendingRow[] {
    return categorias
      .filter((cat) => {
        const t = cat.tipo === 'entrada' ? 'entrada' : 'saida';
        return t === viewTipo;
      })
      .map((cat) => {
        const tipo = viewTipo;
        const transactions = transactionsForCategory(cat.nome, tipo);
        return {
          id: cat.id,
          nome: cat.nome,
          tipo,
          amount: amountForCategory(cat.id, cat.nome, tipo),
          transactions,
        };
      });
  }

  return {
    loading,
    refreshing,
    refresh,
    budgetSummary,
    monthTransactions,
    buildRows,
  };
}

export function formatMonthLabel({ year, month }: MonthRef): string {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${cap} De ${year}`;
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

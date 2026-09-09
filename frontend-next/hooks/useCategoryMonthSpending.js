'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  eligibleTransactionsForCategory,
  getMonthRange,
  normalizarTipo,
  transactionsForCategory,
} from '@/lib/categoryUtils';
import {
  fetchCategoryBudgetsSummary,
  fetchTransactions,
  normalizeTransactionRow,
} from '@/lib/categoryService';

export function useCategoryMonthSpending(monthRef) {
  const { year, month } = monthRef;
  const [budgetSummary, setBudgetSummary] = useState([]);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const { startOfMonth, endOfMonth } = getMonthRange({ year, month });

    try {
      const [summary, allTx] = await Promise.all([
        fetchCategoryBudgetsSummary(year, month),
        fetchTransactions(),
      ]);

      const txs = allTx
        .map(normalizeTransactionRow)
        .filter((tx) => {
          const d = String(tx.data || '').slice(0, 10);
          return d >= startOfMonth && d <= endOfMonth;
        });

      setBudgetSummary(summary);
      setMonthTransactions(txs);
    } catch (err) {
      setBudgetSummary([]);
      setMonthTransactions([]);
      setError(err instanceof Error ? err.message : 'Falha ao carregar movimentações.');
    }
  }, [year, month]);

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

  const summaryByCategoryId = useMemo(
    () =>
      budgetSummary.reduce((acc, item) => {
        acc[item.categorias_id] = item;
        return acc;
      }, {}),
    [budgetSummary],
  );

  const amountForCategory = useCallback(
    (catId, nome, viewTipo) => {
      const summary = summaryByCategoryId[catId];
      if (summary) {
        return viewTipo === 'entrada'
          ? Number(summary.valor_recebido) || 0
          : Number(summary.valor_gasto) || 0;
      }
      return eligibleTransactionsForCategory(nome, viewTipo, monthTransactions).reduce(
        (sum, tx) => sum + tx.valor,
        0,
      );
    },
    [summaryByCategoryId, monthTransactions],
  );

  const hasMovementForCategory = useCallback(
    (nome, viewTipo) =>
      eligibleTransactionsForCategory(nome, viewTipo, monthTransactions).length > 0,
    [monthTransactions],
  );

  const buildRows = useCallback(
    (categorias, viewTipo) =>
      categorias
        .filter((cat) => (cat.tipo === 'entrada' ? 'entrada' : 'saida') === viewTipo)
        .map((cat) => ({
          id: cat.id,
          nome: cat.nome,
          tipo: viewTipo,
          amount: amountForCategory(cat.id, cat.nome, viewTipo),
          transactions: transactionsForCategory(cat.nome, viewTipo, monthTransactions),
          hasMovement: hasMovementForCategory(cat.nome, viewTipo),
        })),
    [amountForCategory, hasMovementForCategory, monthTransactions],
  );

  return {
    loading,
    error,
    refresh: load,
    monthTransactions,
    buildRows,
    amountForCategory,
    hasMovementForCategory,
  };
}

export function computeMonthTotal(rows) {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export function countWithMovement(rows) {
  return rows.filter((row) => row.hasMovement).length;
}

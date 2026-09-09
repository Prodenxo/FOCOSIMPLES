'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizarTipo, normalizarValor } from '@/lib/dashboardUtils';
import { filterTransactionsByConta, resolveDashboardBalance } from '@/lib/contaFinanceiraIntegration';
import { isRealizedLancamentoStatus } from '@/lib/contaSaldo';
import { isInSelectedMonth } from '@/lib/transactionPeriodFilter';
import {
  buildDashboardInsights,
  buildRecentActivity,
  buildTodayFlow,
  computeMonthExpenseTotals,
} from '@/lib/dashboardInsights';
import {
  fetchCategoryBudgetsSummary,
  fetchContasFinanceiras,
  fetchTransactions,
  fetchUserCategories,
} from '@/lib/categoryService';

export function useDashboardData(userId, selectedMonth) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [contas, setContas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState([]);

  const load = useCallback(async () => {
    if (!userId) {
      setTransactions([]);
      setContas([]);
      setCategories([]);
      setBudgetSummary([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [tx, contasRows, cats, budgets] = await Promise.all([
        fetchTransactions(),
        fetchContasFinanceiras(),
        fetchUserCategories(),
        fetchCategoryBudgetsSummary(selectedMonth.year, selectedMonth.month),
      ]);
      setTransactions(tx);
      setContas(contasRows || []);
      setCategories(cats || []);
      setBudgetSummary(budgets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [userId, selectedMonth.year, selectedMonth.month]);

  useEffect(() => {
    load();
  }, [load]);

  const categoriasMap = useMemo(() => {
    const map = {};
    for (const cat of categories) {
      map[String(cat.id)] = cat.nome;
    }
    return map;
  }, [categories]);

  const categoriasTipoMap = useMemo(() => {
    const map = {};
    for (const cat of categories) {
      map[String(cat.id)] = String(cat.tipo || 'saida').toLowerCase() === 'entrada' ? 'entrada' : 'saida';
    }
    return map;
  }, [categories]);

  const contasAtivas = useMemo(() => contas.filter((c) => c.ativo), [contas]);

  const legacyBalance = useMemo(() => {
    let sum = 0;
    for (const t of transactions) {
      if (!isRealizedLancamentoStatus(t.status)) continue;
      const val = normalizarValor(t.valor);
      sum += normalizarTipo(t.tipo) === 'entrada' ? val : -val;
    }
    return sum;
  }, [transactions]);

  const balanceMeta = useMemo(
    () => resolveDashboardBalance(contasAtivas, transactions, legacyBalance, 'all'),
    [contasAtivas, transactions, legacyBalance],
  );

  const balanceLabel =
    balanceMeta.mode === 'contas' ? 'Saldo nas contas' : 'Saldo geral';
  const balanceHint =
    balanceMeta.mode === 'contas' ? 'Soma dos saldos cadastrados' : 'Saldo acumulado';

  const monthTransactions = useMemo(
    () => transactions.filter((t) => isInSelectedMonth(t, selectedMonth)),
    [transactions, selectedMonth],
  );

  const totalIncome = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'entrada' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  const totalExpenses = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'saida' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  const insights = useMemo(
    () => buildDashboardInsights(transactions, selectedMonth.year, selectedMonth.month),
    [transactions, selectedMonth],
  );

  const todayFlow = useMemo(() => buildTodayFlow(transactions), [transactions]);

  const recentActivity = useMemo(
    () =>
      buildRecentActivity(
        transactions,
        selectedMonth.year,
        selectedMonth.month,
        categoriasMap,
        6,
      ),
    [transactions, selectedMonth, categoriasMap],
  );

  const monthExpenseTotals = useMemo(
    () => computeMonthExpenseTotals(monthTransactions),
    [monthTransactions],
  );

  const categorizedBudgets = useMemo(() => {
    return budgetSummary
      .filter((item) => item.valor_orcado !== null && Number(item.valor_orcado) > 0)
      .map((item) => {
        const orcado = normalizarValor(item.valor_orcado);
        const gasto = normalizarValor(item.valor_gasto);
        const recebido = normalizarValor(item.valor_recebido);
        const tipo = categoriasTipoMap[String(item.categorias_id)] || 'saida';
        const realizado = tipo === 'entrada' ? recebido : gasto;
        const percentual = orcado > 0 ? (realizado / orcado) * 100 : 0;
        return {
          categorias_id: item.categorias_id,
          nome: categoriasMap[String(item.categorias_id)] || 'Sem categoria',
          tipo,
          orcado,
          realizado,
          percentual,
        };
      });
  }, [budgetSummary, categoriasMap, categoriasTipoMap]);

  return {
    loading,
    error,
    reload: load,
    balance: balanceMeta.value,
    balanceLabel,
    balanceHint,
    totalIncome,
    totalExpenses,
    insights,
    todayFlow,
    recentActivity,
    monthExpenseTotals,
    categorizedBudgets,
    monthTransactionsCount: monthTransactions.length,
  };
}

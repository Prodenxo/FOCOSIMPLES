'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { AppFooter } from '@/components/layout/AppFooter';
import { BalanceHeroCard } from '@/components/dashboard/BalanceHeroCard';
import { StatGrid } from '@/components/dashboard/StatGrid';
import { TodayMovementsCard } from '@/components/dashboard/TodayMovementsCard';
import { RecentMovementsCard, MonthMovementsCard } from '@/components/dashboard/RecentMovementsCard';
import { BudgetCategoriesCard } from '@/components/dashboard/BudgetCategoriesCard';
import { ContaGlobalCard } from '@/components/dashboard/ContaGlobalCard';

export default function DashboardPage() {
  const { displayName, userId } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [budgetTab, setBudgetTab] = useState('saida');
  const [isBpoView, setIsBpoView] = useState(false);

  const data = useDashboardData(userId, selectedMonth);

  const goToPrevMonth = () => {
    setSelectedMonth(({ year, month }) => {
      const prev = new Date(year, month - 2, 1);
      return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
    });
  };

  const goToNextMonth = () => {
    setSelectedMonth(({ year, month }) => {
      const next = new Date(year, month, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  const header = useMemo(
    () => (
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Olá, {displayName || 'Usuário'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker
            year={selectedMonth.year}
            month={selectedMonth.month}
            onPrev={goToPrevMonth}
            onNext={goToNextMonth}
          />
          <button
            type="button"
            onClick={() => setIsBpoView((v) => !v)}
            aria-pressed={isBpoView}
            className={`inline-flex h-11 items-center gap-2 rounded-[14px] border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              isBpoView
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]'
            }`}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            BPO
          </button>
          <Link
            href="/transacoes?nova=1"
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova transação
          </Link>
        </div>
      </header>
    ),
    [displayName, selectedMonth, isBpoView],
  );

  if (data.loading) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <LoadingPanel label="Carregando indicadores…" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <ErrorPanel message={data.error} onRetry={data.reload} />
      </div>
    );
  }

  if (isBpoView) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Visualização BPO</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-muted)]">
            Matriz e gráficos anuais BPO serão migrados na próxima etapa.
          </p>
          <button
            type="button"
            onClick={() => setIsBpoView(false)}
            className="mt-6 inline-flex h-11 items-center rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white"
          >
            Voltar à visão geral
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Linha 1 — saldo + indicadores (50/50) */}
      <div className="grid gap-5 lg:grid-cols-2">
        <BalanceHeroCard
          label={data.balanceLabel}
          hint={data.balanceHint}
          balance={data.balance}
          totalIncome={data.totalIncome}
          totalExpenses={data.totalExpenses}
        />
        <StatGrid insights={data.insights} />
      </div>

      {/* Linha 2 — 60% / 40% */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <TodayMovementsCard todayFlow={data.todayFlow} />
        <div className="flex flex-col gap-5">
          <RecentMovementsCard
            items={data.recentActivity}
            count={data.monthTransactionsCount}
          />
          <MonthMovementsCard
            pagos={data.monthExpenseTotals.pagos}
            aPagar={data.monthExpenseTotals.aPagar}
          />
        </div>
      </div>

      {/* Linha 3 — 60% / 40% */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <BudgetCategoriesCard
          budgets={data.categorizedBudgets}
          budgetTab={budgetTab}
          onTabChange={setBudgetTab}
        />
        <ContaGlobalCard />
      </div>

      <AppFooter />
    </div>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { TransactionsSkeleton } from '@/components/transactions/TransactionsSkeleton';
import { TransactionsSummaryCards } from '@/components/transactions/TransactionsSummaryCards';
import { TransactionsFilters } from '@/components/transactions/TransactionsFilters';
import { TransactionsExtract } from '@/components/transactions/TransactionsExtract';
import { TransactionDetailsPanel } from '@/components/transactions/TransactionDetailsPanel';
import { MobileDetailsDrawer } from '@/components/transactions/MobileDetailsDrawer';
import { TransactionFormModal } from '@/components/transactions/TransactionFormModal';
import { fetchContasFinanceiras, fetchUserCategories } from '@/lib/categoryService';
import { buildContaNameMap } from '@/lib/contaFinanceiraIntegration';
import { exportTransactionsToExcel } from '@/lib/exportTransactionsSpreadsheet';
import { matchesTransactionPeriod } from '@/lib/transactionPeriodFilter';
import {
  buildDuplicateTransactionDraft,
  computePeriodKpis,
  filterTransactions,
  groupTransactionsByDay,
} from '@/lib/transactionUtils';
import {
  createTransaction,
  deleteTransaction,
  fetchAllTransactions,
  updateTransaction,
} from '@/lib/transactionsApi';
import { formatBrl } from '@/lib/format';

function isCustomRangeValid(dateRange) {
  if (!dateRange.start || !dateRange.end) return false;
  return dateRange.start <= dateRange.end;
}

function TransacoesPageContent() {
  const searchParams = useSearchParams();
  const now = new Date();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [contas, setContas] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [period, setPeriod] = useState('month');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [exporting, setExporting] = useState(false);
  const periodOptions = useMemo(
    () => ({
      period,
      selectedMonth,
      dateRange,
      useCustomRange: useCustomRange && isCustomRangeValid(dateRange),
    }),
    [period, selectedMonth, dateRange, useCustomRange],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txs, cats, accounts] = await Promise.all([
        fetchAllTransactions(),
        fetchUserCategories(),
        fetchContasFinanceiras(),
      ]);
      setTransactions(txs);
      setCategories(cats);
      setContas(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setFormDraft(null);
      setFormOpen(true);
    }
  }, [searchParams]);

  const periodOnlyList = useMemo(
    () => transactions.filter((t) => matchesTransactionPeriod(t, periodOptions)),
    [transactions, periodOptions],
  );

  const filteredList = useMemo(
    () => filterTransactions(transactions, {
      periodOptions,
      search,
      typeFilter,
      statusFilter,
    }),
    [transactions, periodOptions, search, typeFilter, statusFilter],
  );

  const sections = useMemo(() => groupTransactionsByDay(filteredList), [filteredList]);
  const kpis = useMemo(() => computePeriodKpis(filteredList), [filteredList]);

  const selectedTx = useMemo(
    () => filteredList.find((t) => t.id === selectedId) || null,
    [filteredList, selectedId],
  );

  useEffect(() => {
    if (selectedId && !filteredList.some((t) => t.id === selectedId)) {
      setSelectedId(null);
      setMobileDetailsOpen(false);
    }
  }, [filteredList, selectedId]);

  const contaNameById = useMemo(() => buildContaNameMap(contas), [contas]);

  const hasExtraFilters =
    Boolean(search.trim())
    || typeFilter !== 'all'
    || statusFilter !== 'all';

  const emptyPeriod = periodOnlyList.length === 0;

  const handlePrevMonth = () => {
    setPeriod('month');
    setUseCustomRange(false);
    setDateRange({ start: '', end: '' });
    setSelectedMonth(({ year, month }) => {
      const d = new Date(year, month - 2, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const handleNextMonth = () => {
    setPeriod('month');
    setUseCustomRange(false);
    setDateRange({ start: '', end: '' });
    setSelectedMonth(({ year, month }) => {
      const d = new Date(year, month, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const handlePeriodChange = (next) => {
    setPeriod(next);
    setUseCustomRange(false);
    setDateRange({ start: '', end: '' });
    if (next === 'month') return;
    if (next === 'today' || next === 'week') {
      const d = new Date();
      setSelectedMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
  };

  const handleCustomRangeToggle = () => {
    setUseCustomRange((v) => !v);
    if (!useCustomRange) {
      setPeriod('month');
    }
  };

  const handleClearFilters = () => {
    const d = new Date();
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPeriod('month');
    setUseCustomRange(false);
    setDateRange({ start: '', end: '' });
    setSelectedMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const handleSelect = (tx) => {
    setSelectedId(tx.id);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileDetailsOpen(true);
    }
  };

  const openNewForm = () => {
    setFormDraft(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (!selectedTx) return;
    setFormDraft(selectedTx);
    setFormError('');
    setFormOpen(true);
  };

  const openDuplicateForm = () => {
    if (!selectedTx) return;
    setFormDraft(buildDuplicateTransactionDraft(selectedTx));
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (formDraft?.id && !formDraft?._draftDuplicate) {
        await updateTransaction(formDraft.id, payload);
      } else {
        const created = await createTransaction(payload);
        setSelectedId(created.id);
      }
      setFormOpen(false);
      setFormDraft(null);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar transação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTx) return;
    const ok = window.confirm(
      `Excluir "${selectedTx.classificacao}" no valor de ${formatBrl(selectedTx.valor)}?`,
    );
    if (!ok) return;

    setBusyAction(true);
    try {
      await deleteTransaction(selectedTx.id);
      setSelectedId(null);
      setMobileDetailsOpen(false);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir transação.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTransactionsToExcel(filteredList);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Transações</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Consulte e organize seus lançamentos</p>
        </header>
        <TransactionsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Transações</h1>
        </header>
        <ErrorPanel message={error} onRetry={loadAll} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">Transações</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Consulte e organize seus lançamentos</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filteredList.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova transação
          </button>
        </div>
      </header>

      <TransactionsSummaryCards kpis={kpis} />

      <TransactionsFilters
        selectedMonth={selectedMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        period={period}
        onPeriodChange={handlePeriodChange}
        useCustomRange={useCustomRange}
        onCustomRangeToggle={handleCustomRangeToggle}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onClear={handleClearFilters}
      />

      <div className="grid gap-5 lg:grid-cols-[58fr_42fr] lg:items-start">
        <TransactionsExtract
          sections={sections}
          totalCount={filteredList.length}
          selectedId={selectedId}
          onSelect={handleSelect}
          hasFilters={hasExtraFilters || useCustomRange || period !== 'month'}
          onClearFilters={handleClearFilters}
          onNewTransaction={openNewForm}
          emptyPeriod={emptyPeriod && !hasExtraFilters}
        />

        <TransactionDetailsPanel
          className="hidden lg:block"
          transaction={selectedTx}
          contaName={selectedTx?.conta_id ? contaNameById[selectedTx.conta_id] : null}
          onClose={() => setSelectedId(null)}
          onEdit={openEditForm}
          onDuplicate={openDuplicateForm}
          onDelete={handleDelete}
          busy={busyAction}
        />
      </div>

      <MobileDetailsDrawer
        open={mobileDetailsOpen && Boolean(selectedTx)}
        onClose={() => {
          setMobileDetailsOpen(false);
          setSelectedId(null);
        }}
        transaction={selectedTx}
        contaName={selectedTx?.conta_id ? contaNameById[selectedTx.conta_id] : null}
        onEdit={openEditForm}
        onDuplicate={openDuplicateForm}
        onDelete={handleDelete}
        busy={busyAction}
      />

      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setFormDraft(null);
            setFormError('');
          }
        }}
        draft={formDraft}
        categories={categories}
        contas={contas}
        onSubmit={handleFormSubmit}
        saving={saving}
        error={formError}
      />

      <AppFooter />
    </div>
  );
}

export default function TransacoesPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex flex-col gap-5">
          <header>
            <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Transações</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Consulte e organize seus lançamentos</p>
          </header>
          <TransactionsSkeleton />
        </div>
      )}
    >
      <TransacoesPageContent />
    </Suspense>
  );
}

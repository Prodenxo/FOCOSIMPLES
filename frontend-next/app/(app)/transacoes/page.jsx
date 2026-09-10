'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileSpreadsheet, Plus, Repeat } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { TransactionsSkeleton } from '@/components/transactions/TransactionsSkeleton';
import { TransactionsSummaryCards } from '@/components/transactions/TransactionsSummaryCards';
import { TransactionsFilters } from '@/components/transactions/TransactionsFilters';
import { TransactionsExtract } from '@/components/transactions/TransactionsExtract';
import { TransactionDetailsPanel } from '@/components/transactions/TransactionDetailsPanel';
import { MobileDetailsDrawer } from '@/components/transactions/MobileDetailsDrawer';
import { TransactionFormModal } from '@/components/transactions/TransactionFormModal';
import { RecurrenceDeleteDialog } from '@/components/transactions/RecurrenceDeleteDialog';
import { RecorrenciasPanel } from '@/components/recorrencias/RecorrenciasPanel';
import { useRecorrencias } from '@/hooks/useRecorrencias';
import { fetchContasFinanceiras, fetchUserCategories } from '@/lib/categoryService';
import {
  buildMaterializationPayload,
  isProjecao,
  projectRecurrences,
} from '@/lib/recorrenciaProjection';
import { computeProjectionMonthRange } from '@/lib/transactionProjectionRange';
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
  const [recorrenciasOpen, setRecorrenciasOpen] = useState(false);
  const [recFormOpen, setRecFormOpen] = useState(false);
  const [recEditing, setRecEditing] = useState(null);
  const [recFormSaving, setRecFormSaving] = useState(false);
  const [deleteScopeTx, setDeleteScopeTx] = useState(null);

  const {
    recorrencias,
    skips,
    loading: recLoading,
    error: recError,
    loadAll: loadRecorrencias,
    addSkip,
    addRecorrencia,
    updateRecorrencia,
    deleteRecorrencia,
  } = useRecorrencias();

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
        loadRecorrencias(),
      ]);
      setTransactions(txs);
      setCategories(cats);
      setContas(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, [loadRecorrencias]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setFormDraft(null);
      setFormOpen(true);
    }

    const tipo = searchParams.get('tipo');
    if (tipo === 'saida' || tipo === 'entrada') {
      setTypeFilter(tipo);
    }

    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    if (yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
        setSelectedMonth({ year, month });
        setPeriod('month');
        setUseCustomRange(false);
        setDateRange({ start: '', end: '' });
      }
    }
  }, [searchParams]);

  const projectionRange = useMemo(
    () => computeProjectionMonthRange(periodOptions),
    [periodOptions],
  );

  const projections = useMemo(
    () => projectRecurrences(
      recorrencias.filter((r) => r.ativo),
      transactions,
      projectionRange,
      skips,
    ),
    [recorrencias, transactions, projectionRange, skips],
  );

  const combinedTransactions = useMemo(() => {
    const combined = [...transactions, ...projections];
    combined.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    return combined;
  }, [transactions, projections]);

  const periodOnlyList = useMemo(
    () => combinedTransactions.filter((t) => matchesTransactionPeriod(t, periodOptions)),
    [combinedTransactions, periodOptions],
  );

  const filteredList = useMemo(
    () => filterTransactions(combinedTransactions, {
      periodOptions,
      search,
      typeFilter,
      statusFilter,
    }),
    [combinedTransactions, periodOptions, search, typeFilter, statusFilter],
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
    if (isProjecao(selectedTx)) {
      const payload = buildMaterializationPayload(selectedTx);
      const statusAPagar = payload.tipo === 'entrada' ? 'a_receber' : 'a_pagar';
      setFormDraft({ ...payload, status: statusAPagar, __projecao: true });
    } else {
      setFormDraft(selectedTx);
    }
    setFormError('');
    setFormOpen(true);
  };

  const openDuplicateForm = () => {
    if (!selectedTx) return;
    setFormDraft(buildDuplicateTransactionDraft(selectedTx));
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (rawPayload) => {
    setSaving(true);
    setFormError('');
    try {
      const { _recurrenceMeta, ...payload } = rawPayload;
      const meta = _recurrenceMeta || null;

      if (meta?.vinculadaARecorrencia && meta.recorrenciaId && meta.maxOcorrencias != null) {
        const tpl = recorrencias.find((r) => r.id === meta.recorrenciaId);
        if (tpl && tpl.max_ocorrencias !== meta.maxOcorrencias) {
          await updateRecorrencia(meta.recorrenciaId, { max_ocorrencias: meta.maxOcorrencias });
        }
      }

      let body = { ...payload };
      if (meta?.recorrente && !meta.vinculadaARecorrencia && !formDraft?.recorrencia_id) {
        const diaDoMes = Number(String(payload.data || '').slice(8, 10)) || new Date().getDate();
        const created = await addRecorrencia({
          tipo: payload.tipo,
          valor: payload.valor,
          classificacao: payload.classificacao,
          status: payload.status,
          obs: payload.obs,
          dia_do_mes: Math.min(Math.max(diaDoMes, 1), 31),
          ativo: true,
          max_ocorrencias: meta.maxOcorrencias,
          categoria: payload.classificacao,
        });
        if (created?.id) {
          body = {
            ...body,
            recorrencia_id: created.id,
            recorrencia_ano_mes: String(payload.data).slice(0, 7),
          };
        }
      }

      const isMaterialize = meta?.materializeFromProjection || isProjecao(formDraft);
      const isEditReal = formDraft?.id && !formDraft?._draftDuplicate && !isMaterialize;

      if (isEditReal) {
        await updateTransaction(formDraft.id, body);
      } else {
        const created = await createTransaction(body);
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

  const performDeleteOne = async (tx) => {
    if (!tx?.id) return;
    if (tx.recorrencia_id && tx.recorrencia_ano_mes && !isProjecao(tx)) {
      await addSkip(tx.recorrencia_id, tx.recorrencia_ano_mes);
    }
    if (isProjecao(tx) && tx.recorrencia_id && tx.recorrencia_ano_mes) {
      await addSkip(tx.recorrencia_id, tx.recorrencia_ano_mes);
      return;
    }
    await deleteTransaction(tx.id);
  };

  const handleDelete = async () => {
    if (!selectedTx) return;
    if (selectedTx.recorrencia_id && !isProjecao(selectedTx)) {
      setDeleteScopeTx(selectedTx);
      return;
    }
    if (isProjecao(selectedTx)) {
      const ok = window.confirm(
        `Ocultar a projeção "${selectedTx.classificacao}" deste mês?`,
      );
      if (!ok) return;
      setBusyAction(true);
      try {
        await performDeleteOne(selectedTx);
        setSelectedId(null);
        setMobileDetailsOpen(false);
        await loadAll();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Falha ao excluir.');
      } finally {
        setBusyAction(false);
      }
      return;
    }
    const ok = window.confirm(
      `Excluir "${selectedTx.classificacao}" no valor de ${formatBrl(selectedTx.valor)}?`,
    );
    if (!ok) return;

    setBusyAction(true);
    try {
      await performDeleteOne(selectedTx);
      setSelectedId(null);
      setMobileDetailsOpen(false);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir transação.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteOnlyThis = async () => {
    if (!deleteScopeTx) return;
    setBusyAction(true);
    try {
      await performDeleteOne(deleteScopeTx);
      setDeleteScopeTx(null);
      setSelectedId(null);
      setMobileDetailsOpen(false);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteFromHere = async () => {
    if (!deleteScopeTx?.recorrencia_id || !deleteScopeTx?.data) return;
    setBusyAction(true);
    try {
      const recId = deleteScopeTx.recorrencia_id;
      const fromDate = String(deleteScopeTx.data).slice(0, 10);
      const toDelete = transactions.filter(
        (t) => t.recorrencia_id === recId && String(t.data || '') >= fromDate && !isProjecao(t),
      );
      for (const tx of toDelete) {
        await deleteTransaction(tx.id);
      }
      await updateRecorrencia(recId, { ativo: false });
      setDeleteScopeTx(null);
      setSelectedId(null);
      setMobileDetailsOpen(false);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir futuros.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteEntireRecurrence = async () => {
    if (!deleteScopeTx?.recorrencia_id) return;
    setBusyAction(true);
    try {
      const recId = deleteScopeTx.recorrencia_id;
      const toDelete = transactions.filter((t) => t.recorrencia_id === recId && !isProjecao(t));
      for (const tx of toDelete) {
        await deleteTransaction(tx.id);
      }
      await deleteRecorrencia(recId);
      setDeleteScopeTx(null);
      setSelectedId(null);
      setMobileDetailsOpen(false);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir recorrência.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveRecorrencia = async (data) => {
    setRecFormSaving(true);
    try {
      const { id, ...rest } = data;
      if (id) {
        await updateRecorrencia(id, rest);
      } else {
        const created = await addRecorrencia(rest);
        if (!created) {
          window.alert(recError || 'Não foi possível salvar a recorrência.');
          return;
        }
      }
      setRecFormOpen(false);
      setRecEditing(null);
      await loadAll();
    } finally {
      setRecFormSaving(false);
    }
  };

  const handleDeleteRecorrenciaItem = async (r) => {
    const result = await deleteRecorrencia(r.id);
    if (!result.ok) {
      window.alert(result.error || 'Falha ao excluir');
      return;
    }
    if (result.mode === 'soft') {
      window.alert('Recorrência pausada (há lançamentos vinculados).');
    }
    await loadAll();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTransactionsToExcel(filteredList.filter((t) => !isProjecao(t)));
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
            onClick={() => setRecorrenciasOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)]"
          >
            <Repeat className="h-4 w-4" aria-hidden />
            Recorrências
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
        recorrencias={recorrencias}
        onSubmit={handleFormSubmit}
        saving={saving}
        error={formError}
      />

      <RecorrenciasPanel
        open={recorrenciasOpen}
        onClose={() => setRecorrenciasOpen(false)}
        recorrencias={recorrencias}
        loading={recLoading}
        categories={categories}
        onRefresh={loadRecorrencias}
        onSaveRecorrencia={handleSaveRecorrencia}
        onDeleteRecorrencia={handleDeleteRecorrenciaItem}
        formOpen={recFormOpen}
        setFormOpen={setRecFormOpen}
        editing={recEditing}
        setEditing={setRecEditing}
        formSaving={recFormSaving}
        formError={recError}
      />

      <RecurrenceDeleteDialog
        open={Boolean(deleteScopeTx)}
        transaction={deleteScopeTx}
        onClose={() => !busyAction && setDeleteScopeTx(null)}
        onDeleteOnlyThis={handleDeleteOnlyThis}
        onDeleteFromHere={handleDeleteFromHere}
        onDeleteEntireRecurrence={handleDeleteEntireRecurrence}
        busy={busyAction}
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

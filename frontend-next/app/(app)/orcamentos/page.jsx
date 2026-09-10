'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { BudgetCategoryCard } from '@/components/orcamentos/BudgetCategoryCard';
import { BudgetCopyModal } from '@/components/orcamentos/BudgetCopyModal';
import { BudgetEmptyState, BudgetInfoTip } from '@/components/orcamentos/BudgetEmptyState';
import { BudgetFiltersBar } from '@/components/orcamentos/BudgetFiltersBar';
import { BudgetFormModal } from '@/components/orcamentos/BudgetFormModal';
import { BudgetSummaryCards } from '@/components/orcamentos/BudgetSummaryCards';
import { Card } from '@/components/ui/Card';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Pagination } from '@/components/ui/Pagination';
import { mergeCategoriesByName } from '@/lib/categoryUtils';
import { fetchUserCategories } from '@/lib/categoryService';
import {
  buildBudgetRow,
  computeTotals,
  filterBudgetRows,
  formatMonthLabelPt,
  normalizeTipo,
  notifyBudgetsUpdated,
  paginateRows,
  shiftMonth,
  sortBudgetRows,
} from '@/lib/budgetUtils';
import {
  deleteCategoryBudget,
  duplicateMonthlyBudgets,
  fetchCategoryBudgetsSummary,
  getMonthStartDate,
  saveCategoryBudget,
} from '@/lib/budgetService';

const PAGE_SIZE = 9;

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-10 w-48 rounded bg-[var(--card-border)]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 rounded-[14px] bg-[var(--card-border)]" />
        <div className="h-28 rounded-[14px] bg-[var(--card-border)]" />
        <div className="h-28 rounded-[14px] bg-[var(--card-border)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 rounded-[14px] bg-[var(--card-border)]" />
        ))}
      </div>
    </div>
  );
}

export default function OrcamentosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [summary, setSummary] = useState([]);

  const [viewTipo, setViewTipo] = useState('saida');
  const [monthRef, setMonthRef] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('nome');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMeta, setCopyMeta] = useState({ sourceCount: 0, overwriteCount: 0 });
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState(null);

  const summaryByCategoryId = useMemo(() => {
    const map = {};
    for (const item of summary) {
      map[item.categorias_id] = item;
    }
    return map;
  }, [summary]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [cats, sum] = await Promise.all([
        fetchUserCategories(),
        fetchCategoryBudgetsSummary(monthRef.year, monthRef.month),
      ]);
      setCategorias(mergeCategoriesByName(cats));
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar orçamentos.');
      setCategorias([]);
      setSummary([]);
    }
  }, [monthRef.year, monthRef.month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  useEffect(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('nome');
    setPage(1);
  }, [monthRef.year, monthRef.month, viewTipo]);

  const rowsForTipo = useMemo(() => {
    const cats = categorias.filter((c) => normalizeTipo(c.tipo) === viewTipo);
    return cats
      .map((cat) => {
        const item = summaryByCategoryId[cat.id];
        if (item?.valor_orcado == null) return null;
        return buildBudgetRow(cat, item);
      })
      .filter(Boolean);
  }, [categorias, summaryByCategoryId, viewTipo]);

  const totals = useMemo(() => computeTotals(rowsForTipo), [rowsForTipo]);

  const filteredSorted = useMemo(() => {
    const filtered = filterBudgetRows(rowsForTipo, { searchTerm, statusFilter });
    return sortBudgetRows(filtered, sortBy);
  }, [rowsForTipo, searchTerm, statusFilter, sortBy]);

  const pagination = useMemo(
    () => paginateRows(filteredSorted, page, PAGE_SIZE),
    [filteredSorted, page],
  );

  const monthLabel = formatMonthLabelPt(monthRef);
  const sourceMonth = shiftMonth(monthRef, -1);
  const hasBudgets = rowsForTipo.length > 0;
  const isSearchEmpty = hasBudgets && filteredSorted.length === 0;

  const categoriasForCreate = useMemo(() => {
    const withBudget = new Set(rowsForTipo.map((r) => r.id));
    return categorias.filter(
      (c) => normalizeTipo(c.tipo) === viewTipo && !withBudget.has(c.id),
    );
  }, [categorias, viewTipo, rowsForTipo]);

  const openCreate = () => {
    setEditingRow(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setFormError('');
    setModalOpen(true);
  };

  const refreshAfterMutation = async () => {
    await loadAll();
    notifyBudgetsUpdated();
  };

  const handleSave = async ({ categorias_id, valor_orcado }) => {
    setSaving(true);
    setFormError('');
    try {
      await saveCategoryBudget({
        categorias_id,
        valor_orcado,
        date: getMonthStartDate(monthRef.year, monthRef.month),
      });
      setModalOpen(false);
      setEditingRow(null);
      await refreshAfterMutation();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar orçamento.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCategoryBudget(
        deleteTarget.id,
        getMonthStartDate(monthRef.year, monthRef.month),
      );
      setDeleteTarget(null);
      await refreshAfterMutation();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir orçamento.');
    } finally {
      setDeleting(false);
    }
  };

  const prepareCopyModal = async () => {
    setCopyResult(null);
    try {
      const sourceSummary = await fetchCategoryBudgetsSummary(sourceMonth.year, sourceMonth.month);
      const sourceRows = sourceSummary.filter((s) => s.valor_orcado != null);
      const sourceCatIds = new Set(sourceRows.map((s) => s.categorias_id));
      const targetExisting = rowsForTipo.filter((r) => sourceCatIds.has(r.id)).length;
      setCopyMeta({ sourceCount: sourceRows.length, overwriteCount: targetExisting });
      setCopyOpen(true);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao preparar cópia.');
    }
  };

  const handleConfirmCopy = async () => {
    setCopying(true);
    setCopyResult(null);
    try {
      const result = await duplicateMonthlyBudgets(monthRef.year, monthRef.month);
      setCopyOpen(false);
      await refreshAfterMutation();
      const duplicated = Number(result?.duplicated) || 0;
      setCopyResult(
        duplicated > 0
          ? `${duplicated} ${duplicated === 1 ? 'orçamento copiado' : 'orçamentos copiados'} com sucesso.`
          : 'Nenhum orçamento encontrado no mês anterior para copiar.',
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao copiar orçamentos.');
    } finally {
      setCopying(false);
    }
  };

  if (loading && categorias.length === 0 && !error) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Orçamentos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Planeje seu mês e acompanhe seus limites.
          </p>
        </header>
        <PageSkeleton />
        <AppFooter />
      </div>
    );
  }

  if (error && categorias.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Orçamentos</h1>
        </header>
        <ErrorPanel message={error} onRetry={() => loadAll()} />
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">Orçamentos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Planeje seu mês e acompanhe seus limites.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <button
            type="button"
            onClick={prepareCopyModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)]"
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copiar orçamentos
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo orçamento
          </button>
        </div>
      </header>

      {error ? (
        <Card className="border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">{error}</p>
          <button
            type="button"
            onClick={() => loadAll()}
            className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Tentar novamente
          </button>
        </Card>
      ) : null}

      {copyResult ? (
        <Card className="border-[var(--accent)]/30 bg-[var(--accent-soft)]/30 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">{copyResult}</p>
        </Card>
      ) : null}

      <BudgetFiltersBar
        viewTipo={viewTipo}
        onViewTipoChange={setViewTipo}
        year={monthRef.year}
        month={monthRef.month}
        onPrevMonth={() => setMonthRef((m) => shiftMonth(m, -1))}
        onNextMonth={() => setMonthRef((m) => shiftMonth(m, 1))}
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        sortBy={sortBy}
        onSortChange={(v) => {
          setSortBy(v);
          setPage(1);
        }}
        resultCount={hasBudgets ? filteredSorted.length : null}
        showListFilters={hasBudgets}
        budgetCountLabel={
          !hasBudgets
            ? `0 categorias com ${viewTipo === 'entrada' ? 'meta' : 'orçamento'}`
            : `${rowsForTipo.length} ${rowsForTipo.length === 1 ? 'categoria' : 'categorias'} com ${viewTipo === 'entrada' ? 'meta' : 'orçamento'}`
        }
      />

      {!hasBudgets ? (
        <>
          <BudgetEmptyState
            viewTipo={viewTipo}
            onCreate={openCreate}
            onCopy={prepareCopyModal}
          />
          <BudgetInfoTip viewTipo={viewTipo} />
        </>
      ) : (
        <>
          <BudgetSummaryCards
            viewTipo={viewTipo}
            totals={totals}
            categoryCount={rowsForTipo.length}
            loading={loading}
          />

          <div>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
              Orçamentos por categoria
            </h2>

            {isSearchEmpty ? (
              <Card className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Nenhuma categoria encontrada
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Tente outro termo de busca ou altere o filtro de status.
                </p>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pagination.items.map((row) => (
                    <BudgetCategoryCard
                      key={row.id}
                      row={row}
                      viewTipo={viewTipo}
                      onEdit={() => openEdit(row)}
                      onDelete={() => setDeleteTarget(row)}
                    />
                  ))}
                </div>
                <div className="mt-5">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <BudgetFormModal
        open={modalOpen}
        categorias={editingRow ? categorias : categoriasForCreate.length ? categoriasForCreate : categorias}
        viewTipo={viewTipo}
        editingRow={editingRow}
        monthLabel={monthLabel}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingRow(null);
            setFormError('');
          }
        }}
        onSubmit={handleSave}
        saving={saving}
        error={formError}
      />

      <BudgetCopyModal
        open={copyOpen}
        sourceMonth={sourceMonth}
        targetMonth={monthRef}
        sourceCount={copyMeta.sourceCount}
        overwriteCount={copyMeta.overwriteCount}
        onConfirm={handleConfirmCopy}
        onClose={() => {
          if (!copying) setCopyOpen(false);
        }}
        copying={copying}
      />

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-budget-title"
        >
          <Card className="w-full max-w-md p-6">
            <h2 id="delete-budget-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Excluir orçamento
            </h2>
            <p className="mt-2 text-sm text-[var(--text-primary)]">
              Remover o planejamento de &quot;{deleteTarget.nome}&quot; em {monthLabel}?
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              O valor realizado do mês não é apagado. A categoria continua cadastrada.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[var(--card-border)] px-4 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex h-10 items-center justify-center rounded-[12px] bg-red-500 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      <AppFooter />
    </div>
  );
}

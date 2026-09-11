'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { CategoriaFormModal } from '@/components/categorias/CategoriaFormModal';
import { CategoryDistributionPanel } from '@/components/categorias/CategoryDistributionPanel';
import { CategoryFiltersBar } from '@/components/categorias/CategoryFiltersBar';
import { CategoryRow } from '@/components/categorias/CategoryRow';
import { CategorySummaryCard } from '@/components/categorias/CategorySummaryCard';
import { Card } from '@/components/ui/Card';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { useAuth } from '@/context/AuthProvider';
import {
  computeMonthTotal,
  countWithMovement,
  useCategoryMonthSpending,
} from '@/hooks/useCategoryMonthSpending';
import {
  createCategory,
  deleteCategory,
  fetchUserCategories,
  updateCategory,
} from '@/lib/categoryService';
import {
  formatMonthLabelPt,
  isEligibleTransaction,
  mergeCategoriesByName,
  normalizeCategoryKey,
  shiftMonth,
} from '@/lib/categoryUtils';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-28 rounded-[14px] bg-[var(--card-border)]" />
      <div className="h-24 rounded-[14px] bg-[var(--card-border)]" />
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="h-80 rounded-[14px] bg-[var(--card-border)]" />
        <div className="h-80 rounded-[14px] bg-[var(--card-border)]" />
      </div>
    </div>
  );
}

export default function CategoriasPage() {
  const { userId } = useAuth();

  const [loadingCats, setLoadingCats] = useState(true);
  const [catsError, setCatsError] = useState(null);
  const [categorias, setCategorias] = useState([]);

  const [viewTipo, setViewTipo] = useState('saida');
  const [searchTerm, setSearchTerm] = useState('');
  const [monthRef, setMonthRef] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [expandedIds, setExpandedIds] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const {
    loading: loadingSpend,
    error: spendError,
    refresh: refreshSpend,
    buildRows,
    monthTransactions,
  } = useCategoryMonthSpending(monthRef);

  const fetchCategorias = useCallback(async () => {
    setLoadingCats(true);
    setCatsError(null);
    try {
      const data = await fetchUserCategories();
      setCategorias(mergeCategoriesByName(data));
    } catch (err) {
      setCatsError(err instanceof Error ? err.message : 'Falha ao carregar categorias.');
      setCategorias([]);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useEffect(() => {
    setExpandedIds({});
    setSearchTerm('');
  }, [monthRef.year, monthRef.month, viewTipo]);

  const orphanRow = useMemo(() => {
    const catKeys = new Set(
      categorias
        .filter((c) => (c.tipo === 'entrada' ? 'entrada' : 'saida') === viewTipo)
        .map((c) => normalizeCategoryKey(c.nome)),
    );
    const orphanTxs = monthTransactions.filter((tx) => {
      if (!isEligibleTransaction(tx, viewTipo)) return false;
      const key = normalizeCategoryKey(tx.classificacao);
      return !key || !catKeys.has(key);
    });
    if (orphanTxs.length === 0) return null;
    const orphanAmount = orphanTxs.reduce((sum, tx) => sum + tx.valor, 0);
    return {
      id: -1,
      nome: 'Sem categoria',
      tipo: viewTipo,
      amount: orphanAmount,
      transactions: orphanTxs,
      hasMovement: orphanTxs.length > 0,
    };
  }, [categorias, monthTransactions, viewTipo]);

  const allRowsUnfiltered = useMemo(() => {
    const rows = buildRows(categorias, viewTipo);
    const merged = orphanRow ? [...rows, orphanRow] : rows;
    return merged.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }, [buildRows, categorias, viewTipo, orphanRow]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allRowsUnfiltered;
    return allRowsUnfiltered.filter((r) => normalizeCategoryKey(r.nome).includes(term));
  }, [allRowsUnfiltered, searchTerm]);

  const rowsForTipoCount = useMemo(
    () => categorias.filter((c) => (c.tipo === 'entrada' ? 'entrada' : 'saida') === viewTipo).length,
    [categorias, viewTipo],
  );

  const totalMonth = useMemo(() => computeMonthTotal(allRowsUnfiltered), [allRowsUnfiltered]);
  const activeCount = useMemo(
    () => countWithMovement(allRowsUnfiltered.filter((row) => row.id >= 0)),
    [allRowsUnfiltered],
  );

  const topActiveId = allRowsUnfiltered.find((r) => r.hasMovement)?.id;
  useEffect(() => {
    if (topActiveId == null) return;
    setExpandedIds({ [topActiveId]: true });
  }, [monthRef.year, monthRef.month, viewTipo, topActiveId]);

  const monthLabel = formatMonthLabelPt(monthRef);
  const loading = loadingCats || loadingSpend;
  const loadError = catsError || spendError;

  const openCreate = () => {
    setEditingCategoria(null);
    setFormError('');
    setModalOpen(true);
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resolveDefaultCategoryName = (tipoNormalizado) => {
    const preferred = tipoNormalizado === 'saida' ? 'Outros (saída)' : 'Outros (entrada)';
    const exact = categorias.find(
      (c) =>
        String(c.nome).trim().toLowerCase() === preferred.toLowerCase() &&
        (c.tipo === 'entrada' ? 'entrada' : 'saida') === tipoNormalizado,
    );
    if (exact) return exact.nome;
    const fallback = categorias.find(
      (c) =>
        /outros/i.test(String(c.nome)) &&
        (c.tipo === 'entrada' ? 'entrada' : 'saida') === tipoNormalizado,
    );
    return fallback?.nome ?? preferred;
  };

  const handleSubmit = async (payload, id) => {
    setSaving(true);
    setFormError('');
    try {
      if (id) {
        const cat = categorias.find((c) => c.id === id);
        if (!cat?.user_id || cat.user_id !== userId) {
          setFormError('Você não tem permissão para editar esta categoria.');
          return;
        }
        await updateCategory({ id, nome: payload.nome, tipo: payload.tipo });
      } else {
        await createCategory(payload);
      }
      setModalOpen(false);
      setEditingCategoria(null);
      await Promise.all([fetchCategorias(), refreshSpend()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const tipoNormalizado = deleteTarget.tipo === 'entrada' ? 'entrada' : 'saida';
      const nomePadrao = resolveDefaultCategoryName(tipoNormalizado);
      await deleteCategory(deleteTarget.id, nomePadrao);
      setDeleteTarget(null);
      await Promise.all([fetchCategorias(), refreshSpend()]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir categoria.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && categorias.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Categorias</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Organize suas receitas e despesas.</p>
        </header>
        <PageSkeleton />
        <AppFooter />
      </div>
    );
  }

  if (loadError && categorias.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Categorias</h1>
        </header>
        <ErrorPanel
          message={loadError}
          onRetry={() => {
            fetchCategorias();
            refreshSpend();
          }}
        />
        <AppFooter />
      </div>
    );
  }

  const listContent =
    filteredRows.length === 0 ? (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {searchTerm.trim()
            ? 'Nenhuma categoria encontrada'
            : rowsForTipoCount === 0
              ? 'Nenhuma categoria cadastrada'
              : 'Nenhuma categoria para este tipo'}
        </p>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
          {searchTerm.trim()
            ? 'Tente outro termo de busca.'
            : 'Crie categorias personalizadas para organizar seus lançamentos.'}
        </p>
        {!searchTerm.trim() && rowsForTipoCount === 0 ? (
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova categoria
          </button>
        ) : null}
      </div>
    ) : (
      filteredRows.map((row) => {
        const cat = categorias.find((c) => c.id === row.id);
        const canManage = row.id >= 0 && cat?.user_id === userId;
        return (
          <CategoryRow
            key={row.id}
            row={row}
            expanded={!!expandedIds[row.id]}
            onToggle={() => toggleExpanded(row.id)}
            onEdit={() => {
              if (!canManage) return;
              setEditingCategoria(cat);
              setFormError('');
              setModalOpen(true);
            }}
            onDelete={() => {
              if (!canManage || !cat) return;
              setDeleteTarget(cat);
            }}
            hideActions={row.id < 0 || !canManage}
            dimmed={!row.hasMovement}
          />
        );
      })
    );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">Categorias</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Organize suas receitas e despesas.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova categoria
        </button>
      </header>

      {loadError && categorias.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">{loadError}</p>
          <button
            type="button"
            onClick={() => refreshSpend()}
            className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Tentar novamente
          </button>
        </Card>
      ) : null}

      <CategorySummaryCard
        viewTipo={viewTipo}
        totalMonth={totalMonth}
        monthLabel={monthLabel}
        categoryCount={rowsForTipoCount}
        activeCount={activeCount}
        loading={loadingSpend}
      />

      <CategoryFiltersBar
        viewTipo={viewTipo}
        onViewTipoChange={setViewTipo}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        year={monthRef.year}
        month={monthRef.month}
        onPrevMonth={() => setMonthRef((m) => shiftMonth(m, -1))}
        onNextMonth={() => setMonthRef((m) => shiftMonth(m, 1))}
        searchResultCount={searchTerm.trim() ? filteredRows.length : null}
      />

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="p-0">
          <div className="border-b border-[var(--card-border)] px-5 py-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Suas categorias</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {searchTerm.trim()
                ? `${filteredRows.length} ${filteredRows.length === 1 ? 'resultado' : 'resultados'}`
                : `${rowsForTipoCount} ${rowsForTipoCount === 1 ? 'categoria' : 'categorias'}`}
              {!searchTerm.trim() && activeCount > 0 ? ` · ${activeCount} com movimento` : ''}
            </p>
          </div>
          <div className="px-3 sm:px-5">{listContent}</div>
        </Card>

        <CategoryDistributionPanel
          viewTipo={viewTipo}
          monthRef={monthRef}
          rowsWithMovement={allRowsUnfiltered.filter((r) => r.hasMovement)}
          totalMonth={totalMonth}
        />
      </div>

      <CategoriaFormModal
        open={modalOpen}
        categoria={editingCategoria}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingCategoria(null);
            setFormError('');
          }
        }}
        onSubmit={handleSubmit}
        saving={saving}
        error={formError}
      />

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-categoria-title"
        >
          <Card className="w-full max-w-md p-6">
            <h2 id="delete-categoria-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Excluir categoria
            </h2>
            <p className="mt-2 text-sm text-[var(--text-primary)]">
              Excluir &quot;{deleteTarget.nome}&quot;?
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Os lançamentos passam para a categoria padrão.
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

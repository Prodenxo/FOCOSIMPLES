'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Plus } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { AddMoedaCard } from '@/components/conta-global/AddMoedaCard';
import { ContaGlobalSummaryCard } from '@/components/conta-global/ContaGlobalSummaryCard';
import { ContaMoedaCard } from '@/components/conta-global/ContaMoedaCard';
import { ContaMoedaFormModal } from '@/components/conta-global/ContaMoedaFormModal';
import { GlobalAccountEmptyIllustration } from '@/components/illustrations/GlobalAccountEmptyIllustration';
import { Card } from '@/components/ui/Card';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import {
  computeContaGlobalTotal,
  createContaMoedaGlobal,
  deleteContaMoedaGlobal,
  fetchContasMoedaGlobal,
  updateContaMoedaGlobal,
} from '@/lib/contaMoedaGlobalApi';
import {
  fetchMoedasGlobaisCotacoes,
  fetchMoedasGlobaisCurrencies,
} from '@/lib/moedasGlobaisService';
import { formatMoedaValorAmount } from '@/lib/moedaFormat';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-[var(--card-border)]" />
      <div className="h-28 rounded-[14px] bg-[var(--card-border)]" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[180px] rounded-[14px] bg-[var(--card-border)]" />
        ))}
      </div>
    </div>
  );
}

export default function ContaGlobalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contas, setContas] = useState([]);
  const [rates, setRates] = useState({});
  const ratesRef = useRef(rates);
  ratesRef.current = rates;
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null);
  const [ratesError, setRatesError] = useState(null);

  const [currencyCatalog, setCurrencyCatalog] = useState({});
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadRates = useCallback(async (codes) => {
    if (!codes.length) {
      setRates({});
      ratesRef.current = {};
      setRatesLoading(false);
      setRatesError(null);
      return;
    }

    const needLoad = codes.some((c) => c !== 'BRL' && ratesRef.current[c] == null);
    if (needLoad) setRatesLoading(true);

    try {
      const { rates: next, updatedAt } = await fetchMoedasGlobaisCotacoes(codes);
      setRates((prev) => {
        const merged = { ...prev, ...next };
        ratesRef.current = merged;
        return merged;
      });
      if (updatedAt) setRatesUpdatedAt(updatedAt);
      setRatesError(null);
    } catch (err) {
      setRatesError(err instanceof Error ? err.message : 'Falha ao carregar cotações.');
    } finally {
      setRatesLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchContasMoedaGlobal();
      setContas(rows);
      const codes = rows.map((c) => c.moeda);
      await loadRates(codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar moedas.');
    } finally {
      setLoading(false);
    }
  }, [loadRates]);

  useEffect(() => {
    loadAll();
    setCatalogLoading(true);
    fetchMoedasGlobaisCurrencies()
      .then(setCurrencyCatalog)
      .finally(() => setCatalogLoading(false));
  }, [loadAll]);

  const totalState = useMemo(
    () => computeContaGlobalTotal(contas, rates),
    [contas, rates],
  );

  const registeredMoedas = useMemo(
    () => contas.map((c) => c.moeda),
    [contas],
  );

  const openCreate = () => {
    setEditingConta(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (conta) => {
    setEditingConta(conta);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (payload, id) => {
    setSaving(true);
    setFormError('');
    try {
      if (id) {
        await updateContaMoedaGlobal(id, payload);
      } else {
        await createContaMoedaGlobal(payload);
      }
      setModalOpen(false);
      setEditingConta(null);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar moeda.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContaMoedaGlobal(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir moeda.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && contas.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Conta global</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe seus saldos em outras moedas.
          </p>
        </header>
        <PageSkeleton />
        <AppFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Conta global</h1>
        </header>
        <ErrorPanel message={error} onRetry={loadAll} />
        <AppFooter />
      </div>
    );
  }

  const hasMoedas = contas.length > 0;
  const countLabel =
    contas.length === 1 ? '1 moeda cadastrada.' : `${contas.length} moedas cadastradas.`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">
            Conta global
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe seus saldos em outras moedas.
          </p>
          {!hasMoedas ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">0 moedas cadastradas.</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{countLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar moeda
        </button>
      </header>

      {ratesError && hasMoedas ? (
        <Card className="border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">
            Não foi possível atualizar todas as cotações. Valores anteriores foram mantidos quando disponíveis.
          </p>
          <button
            type="button"
            onClick={() => loadRates(contas.map((c) => c.moeda))}
            className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Tentar novamente
          </button>
        </Card>
      ) : null}

      {hasMoedas ? (
        <>
          <ContaGlobalSummaryCard
            totalBrl={totalState.total}
            moedaCount={contas.length}
            ratesLoading={ratesLoading}
            allRatesAvailable={totalState.allRatesAvailable}
            missingRateCount={totalState.missing}
            ratesUpdatedAt={ratesUpdatedAt}
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Suas moedas</h2>
              <p className="text-sm text-[var(--text-muted)]">Valores convertidos aproximados.</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {contas.map((conta) => (
                <ContaMoedaCard
                  key={conta.id}
                  conta={conta}
                  rate={conta.moeda === 'BRL' ? 1 : rates[conta.moeda] ?? null}
                  ratesLoading={ratesLoading}
                  onEdit={() => openEdit(conta)}
                  onDelete={() => setDeleteTarget(conta)}
                />
              ))}
              <AddMoedaCard onClick={openCreate} />
            </div>
          </section>
        </>
      ) : (
        <>
          <Card className="relative flex flex-col items-center overflow-hidden px-6 py-12 text-center sm:py-14">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--accent)]/[0.07]"
              aria-hidden
            />
            <GlobalAccountEmptyIllustration className="mx-auto w-[220px] max-w-full" />
            <h2 className="relative mt-7 text-xl font-semibold text-[var(--text-primary)] sm:text-[1.375rem]">
              Nenhuma moeda cadastrada
            </h2>
            <p className="relative mt-2 max-w-[400px] text-sm leading-relaxed text-[var(--text-muted)]">
              Registre seus saldos em dólar, euro e outras moedas.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="relative mt-7 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,133,106,0.28)]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar primeira moeda
            </button>
          </Card>

          <Card className="flex items-start gap-3 border-[var(--accent)]/25 bg-[var(--accent-soft)]/35 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Globe className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Separado do saldo em reais.
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                As conversões são estimativas e não entram no saldo da Visão geral.
              </p>
            </div>
          </Card>
        </>
      )}

      <ContaMoedaFormModal
        open={modalOpen}
        conta={editingConta}
        currencyCatalog={currencyCatalog}
        catalogLoading={catalogLoading}
        registeredMoedas={registeredMoedas}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingConta(null);
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
          aria-labelledby="delete-moeda-title"
        >
          <Card className="w-full max-w-md p-6">
            <h2 id="delete-moeda-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Remover moeda?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-primary)]">
              Excluir {deleteTarget.moeda}
              {deleteTarget.nome ? ` (${deleteTarget.nome})` : ''} —{' '}
              {formatMoedaValorAmount(deleteTarget.valor, deleteTarget.moeda)}?
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

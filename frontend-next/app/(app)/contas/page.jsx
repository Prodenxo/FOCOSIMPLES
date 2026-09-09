'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { Card } from '@/components/ui/Card';
import { ContaCard } from '@/components/contas/ContaCard';
import { ContaFormModal } from '@/components/contas/ContaFormModal';
import { ContasSummaryCard } from '@/components/contas/ContasSummaryCard';
import { AccountsEmptyIllustration } from '@/components/illustrations/AccountsEmptyIllustration';
import { computeContaSaldoAtual } from '@/lib/contaSaldo';
import { sumSaldosContas } from '@/lib/contaFinanceiraIntegration';
import {
  isDefaultContaFinanceira,
  sortContasWithDefaultFirst,
} from '@/lib/contaFinanceiraDefault';
import {
  createContaFinanceira,
  deleteContaFinanceira,
  fetchContasFinanceiras,
  updateContaFinanceira,
} from '@/lib/contasApi';
import { fetchTransactions } from '@/lib/categoryService';

export default function ContasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contas, setContas] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contasRows, txs] = await Promise.all([
        fetchContasFinanceiras(true),
        fetchTransactions(),
      ]);
      setContas(contasRows);
      setTransactions(txs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar contas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const contasAtivas = useMemo(
    () => sortContasWithDefaultFirst(contas.filter((c) => c.ativo)),
    [contas],
  );

  const saldosPorConta = useMemo(() => {
    const map = {};
    for (const c of contasAtivas) {
      map[c.id] = computeContaSaldoAtual(c.saldo_inicial, transactions, c.id);
    }
    return map;
  }, [contasAtivas, transactions]);

  const totalConsolidado = useMemo(
    () => sumSaldosContas(contasAtivas, transactions),
    [contasAtivas, transactions],
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
        await updateContaFinanceira(id, payload);
      } else {
        await createContaFinanceira(payload);
      }
      setModalOpen(false);
      setEditingConta(null);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar conta.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContaFinanceira(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao excluir conta.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Contas e cartões</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Acompanhe seus saldos por instituição.</p>
        </header>
        <LoadingPanel label="Carregando contas…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-[2rem] font-bold text-[var(--text-primary)]">Contas e cartões</h1>
        </header>
        <ErrorPanel message={error} onRetry={loadAll} />
      </div>
    );
  }

  const hasAccounts = contasAtivas.length > 0;
  const subtitle = hasAccounts
    ? 'Acompanhe seus saldos por instituição.'
    : 'Organize suas contas e acompanhe seus saldos.';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">
            Contas e cartões
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
          {!hasAccounts ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">0 contas cadastradas.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova conta
        </button>
      </header>

      {hasAccounts ? (
        <>
          <ContasSummaryCard
            totalConsolidado={totalConsolidado}
            accountCount={contasAtivas.length}
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Minhas contas</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {contasAtivas.length === 1
                  ? '1 conta cadastrada.'
                  : `${contasAtivas.length} contas cadastradas.`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {contasAtivas.map((conta) => (
                <ContaCard
                  key={conta.id}
                  conta={conta}
                  saldo={saldosPorConta[conta.id] ?? conta.saldo_inicial}
                  isDefault={isDefaultContaFinanceira(conta, contasAtivas)}
                  onEdit={() => openEdit(conta)}
                  onDelete={() => setDeleteTarget(conta)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar outra conta
            </button>
          </section>
        </>
      ) : (
        <>
          <Card className="relative flex flex-col items-center overflow-hidden px-6 py-12 text-center sm:py-14">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--accent)]/[0.07]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[var(--accent)]/[0.05]"
              aria-hidden
            />

            <AccountsEmptyIllustration />
            <h2 className="relative mt-7 text-xl font-semibold leading-snug text-[var(--text-primary)] sm:text-[1.375rem]">
              Nenhuma conta ainda
            </h2>
            <p className="relative mt-2 max-w-[400px] text-sm leading-relaxed text-[var(--text-muted)]">
              Cadastre contas e cartões para acompanhar seus saldos por instituição.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="relative mt-7 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,133,106,0.28)] transition hover:brightness-110 dark:shadow-[0_4px_18px_rgba(0,168,132,0.32)]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Cadastrar primeira conta
            </button>
          </Card>

          <Card className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm text-[var(--text-muted)]">
              Suas contas organizadas em um só lugar.
            </p>
          </Card>
        </>
      )}

      <ContaFormModal
        open={modalOpen}
        conta={editingConta}
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
          aria-labelledby="delete-conta-title"
        >
          <Card className="w-full max-w-md p-6">
            <h2 id="delete-conta-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Excluir conta
            </h2>
            <p className="mt-2 text-sm text-[var(--text-primary)]">
              Remover &quot;{deleteTarget.nome}&quot;?
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Lançamentos vinculados ficarão sem conta.
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

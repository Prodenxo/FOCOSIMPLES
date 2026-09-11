'use client';

import { Loader2, X } from 'lucide-react';

export function RecurrenceDeleteDialog({
  open,
  transaction,
  onClose,
  onDeleteOnlyThis,
  onDeleteFromHere,
  onDeleteEntireRecurrence,
  busy,
}) {
  if (!open || !transaction) return null;

  const label = transaction.classificacao || 'lançamento';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Excluir lançamento recorrente"
    >
      <div className="w-full max-w-md rounded-[14px] bg-[var(--card-bg)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Excluir recorrência</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          &quot;{label}&quot; faz parte de uma recorrência. O que deseja fazer?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteOnlyThis}
            className="rounded-[14px] border border-[var(--card-border)] px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--canvas)] disabled:opacity-50"
          >
            Apenas este lançamento
            <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
              Os outros meses continuam; este mês não volta a aparecer como projeção.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteFromHere}
            className="rounded-[14px] border border-amber-200 px-4 py-3 text-left text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-200"
          >
            Este e os futuros
            <span className="mt-0.5 block text-xs font-normal opacity-80">
              Remove lançamentos futuros e pausa a recorrência.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteEntireRecurrence}
            className="rounded-[14px] border border-red-200 px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
          >
            Toda a recorrência
            <span className="mt-0.5 block text-xs font-normal opacity-80">
              Apaga o template e todos os lançamentos vinculados.
            </span>
          </button>
        </div>
        {busy ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando…
          </p>
        ) : null}
      </div>
    </div>
  );
}

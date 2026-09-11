'use client';

import { Copy, Pencil, Wallet, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TransactionDetailsIllustration } from '@/components/illustrations/TransactionDetailsIllustration';
import { formatBrl } from '@/lib/format';
import { normalizarTipo } from '@/lib/dashboardUtils';
import {
  formatTransactionDateDisplay,
  getStatusMeta,
  resolveTransactionOrigin,
} from '@/lib/transactionUtils';

function StatusBadge({ status, compact = false }) {
  const meta = getStatusMeta(status);
  const cls =
    meta.tone === 'success'
      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
      : meta.tone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
        : 'bg-[var(--canvas)] text-[var(--text-muted)]';

  return (
    <span
      className={`inline-flex rounded-full font-semibold ${cls} ${
        compact ? 'px-2 py-0.5 text-[11px] leading-none' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {meta.label}
    </span>
  );
}

function DetailRow({ label, value, multiline = false, scrollable = false }) {
  return (
    <div
      className={`flex min-h-[2.75rem] gap-4 border-b border-[var(--card-border)] py-2 last:border-b-0 ${
        multiline ? 'items-start' : 'items-center'
      }`}
    >
      <span className="w-[5.5rem] shrink-0 text-sm text-[var(--text-muted)]">{label}</span>
      <span
        className={`min-w-0 flex-1 text-sm font-medium text-[var(--text-primary)] ${
          multiline ? 'whitespace-pre-wrap break-words' : 'text-right'
        } ${scrollable ? 'app-scrollbar max-h-28 overflow-y-auto pr-1 text-left' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export function TransactionDetailsPanel({
  transaction,
  contaName,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  busy,
  className = '',
}) {
  if (!transaction) {
    return (
      <Card className={`relative flex flex-col items-center justify-center overflow-hidden p-8 text-center ${className}`}>
        <TransactionDetailsIllustration />
        <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
          Selecione uma transação para ver os detalhes
        </p>
        <p className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">
          Clique em um lançamento do extrato para visualizar informações completas.
        </p>
      </Card>
    );
  }

  const isEntrada = normalizarTipo(transaction.tipo) === 'entrada';
  const origin = resolveTransactionOrigin(transaction);

  return (
    <Card className={`relative flex flex-col overflow-hidden p-0 ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-4 py-2.5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Detalhes da transação</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--canvas)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="relative px-4 py-3">
        <div className="pointer-events-none absolute -right-2 top-0 scale-75 opacity-25">
          <TransactionDetailsIllustration />
        </div>

        <div className="relative flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isEntrada ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--expense-soft)] text-red-500'
            }`}
          >
            <Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold leading-snug text-[var(--text-primary)]">
              {transaction.classificacao}
            </p>
            <p
              className={`tabular-nums mt-0.5 text-xl font-bold leading-tight ${
                isEntrada ? 'text-[var(--accent)]' : 'text-red-500'
              }`}
            >
              {isEntrada ? '+' : '−'} {formatBrl(transaction.valor)}
            </p>
            <div className="mt-1">
              <StatusBadge status={transaction.status} compact />
            </div>
          </div>
        </div>

        <div className="relative mt-3">
          <DetailRow label="Tipo" value={isEntrada ? 'Entrada' : 'Saída'} />
          <DetailRow label="Data" value={formatTransactionDateDisplay(transaction)} />
          <DetailRow label="Origem" value={origin || '—'} />
          <DetailRow label="Status" value={<StatusBadge status={transaction.status} compact />} />
          {contaName ? <DetailRow label="Conta" value={contaName} /> : null}
          {transaction.obs ? (
            <DetailRow label="Observação" value={transaction.obs} multiline scrollable />
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--accent)] px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Editar</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDuplicate}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-60"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Duplicar</span>
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="mt-2 w-full py-1 text-center text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-60 dark:hover:text-red-400"
        >
          Excluir transação
        </button>
      </div>
    </Card>
  );
}

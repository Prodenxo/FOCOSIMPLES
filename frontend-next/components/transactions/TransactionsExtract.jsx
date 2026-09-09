'use client';

import { ChevronRight, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl } from '@/lib/format';
import { normalizarTipo } from '@/lib/dashboardUtils';
import { getStatusMeta, getTransactionSubtitle } from '@/lib/transactionUtils';
import { NoMovementsIllustration } from '@/components/illustrations/NoMovementsIllustration';

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  const cls =
    meta.tone === 'success'
      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
      : meta.tone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
        : 'bg-[var(--canvas)] text-[var(--text-muted)]';

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${cls}`}>
      {meta.label}
    </span>
  );
}

export function TransactionsExtract({
  sections,
  totalCount,
  selectedId,
  onSelect,
  hasFilters,
  onClearFilters,
  onNewTransaction,
  emptyPeriod,
  className = '',
}) {
  if (emptyPeriod) {
    return (
      <Card className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
        <NoMovementsIllustration />
        <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
          Nenhum lançamento no período
        </p>
        <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
          Registre receitas e despesas para acompanhar seu fluxo financeiro.
        </p>
        <button
          type="button"
          onClick={onNewTransaction}
          className="mt-5 inline-flex h-11 items-center rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white"
        >
          Nova transação
        </button>
      </Card>
    );
  }

  if (totalCount === 0) {
    return (
      <Card className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Nenhum resultado para os filtros atuais
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tente ampliar o período ou limpar a busca.
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-5 inline-flex h-11 items-center rounded-[14px] border border-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent)]"
          >
            Limpar filtros
          </button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col overflow-hidden p-0 lg:max-h-[calc(100dvh-17.5rem)] lg:min-h-[16rem] ${className}`}>
      <div className="shrink-0 border-b border-[var(--card-border)] px-5 py-3.5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Extrato</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {totalCount === 1 ? '1 movimentação no período' : `${totalCount} movimentações no período`}
        </p>
      </div>

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {sections.map((section) => (
          <div key={section.date} className="mb-2 last:mb-0">
            <p className="sticky top-0 z-[1] bg-[var(--card-bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((tx) => {
                const isEntrada = normalizarTipo(tx.tipo) === 'entrada';
                const selected = selectedId === tx.id;
                const subtitle = getTransactionSubtitle(tx);
                return (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(tx)}
                      className={`flex min-h-[5rem] w-full items-center gap-2.5 rounded-[12px] border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                        selected
                          ? 'border-[var(--accent)]/25 bg-[var(--accent-soft)]'
                          : 'border-transparent hover:bg-[var(--canvas)]'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isEntrada ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--expense-soft)] text-red-500'
                        }`}
                      >
                        <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-snug text-[var(--text-primary)]">
                          {tx.classificacao}
                        </span>
                        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                          {subtitle ? (
                            <span className="truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
                          ) : null}
                          <StatusBadge status={tx.status} />
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 self-center">
                        <span
                          className={`tabular-nums text-sm font-bold leading-none ${
                            isEntrada ? 'text-[var(--accent)]' : 'text-red-500'
                          }`}
                        >
                          {isEntrada ? '+' : '−'} {formatBrl(tx.valor)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)] lg:hidden" aria-hidden />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

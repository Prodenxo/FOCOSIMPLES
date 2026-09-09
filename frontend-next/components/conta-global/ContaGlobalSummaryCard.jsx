'use client';

import { Globe } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { GlobalAccountSummaryDecor } from '@/components/illustrations/GlobalAccountSummaryDecor';
import { formatBrl } from '@/lib/format';

export function ContaGlobalSummaryCard({
  totalBrl,
  moedaCount,
  ratesLoading,
  allRatesAvailable,
  missingRateCount,
  ratesUpdatedAt,
}) {
  const countBadge =
    moedaCount === 1 ? '1 moeda' : `${moedaCount} moedas`;

  let totalDisplay = formatBrl(totalBrl);
  let totalHint = 'Cotação de referência · Não incluído no saldo da Visão geral.';

  if (ratesLoading && !allRatesAvailable) {
    totalDisplay = '…';
  } else if (!allRatesAvailable && missingRateCount > 0) {
    totalHint = `Total parcial — cotação indisponível para ${missingRateCount} ${
      missingRateCount === 1 ? 'moeda' : 'moedas'
    }. Não incluído no saldo da Visão geral.`;
  }

  const updatedLabel = ratesUpdatedAt
    ? new Date(ratesUpdatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="relative overflow-hidden p-0">
      <GlobalAccountSummaryDecor className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 opacity-70 sm:block" />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Globe className="h-6 w-6" strokeWidth={1.65} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Valor estimado em reais
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="tabular-nums text-2xl font-bold leading-tight text-[var(--text-primary)] sm:text-[1.75rem]">
              {totalDisplay}
            </p>
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
              {countBadge}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{totalHint}</p>
          {updatedLabel ? (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Cotações referência de {updatedLabel}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

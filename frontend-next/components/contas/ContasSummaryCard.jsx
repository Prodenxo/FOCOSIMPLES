'use client';

import { Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl } from '@/lib/format';

function DecorCircles() {
  return (
    <svg
      width="120"
      height="100"
      viewBox="0 0 120 100"
      fill="none"
      className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 opacity-60"
      aria-hidden="true"
    >
      <circle cx="70" cy="50" r="42" fill="var(--accent-soft)" opacity="0.35" />
      <circle cx="70" cy="50" r="28" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.6" />
      <circle cx="70" cy="50" r="16" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.45" />
    </svg>
  );
}

export function ContasSummaryCard({ totalConsolidado, accountCount }) {
  const countHint =
    accountCount === 1 ? '1 conta cadastrada.' : `${accountCount} contas cadastradas.`;
  const saldoColor = totalConsolidado >= 0 ? 'text-[var(--accent)]' : 'text-red-500';

  return (
    <Card className="relative overflow-hidden p-0">
      <DecorCircles />
      <div className="relative grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Total nas contas
            </p>
            <p className={`tabular-nums mt-0.5 text-2xl font-bold leading-tight sm:text-3xl ${saldoColor}`}>
              {formatBrl(totalConsolidado)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Soma dos saldos atuais</p>
          </div>
        </div>

        <div className="hidden h-16 w-px bg-[var(--card-border)] sm:block" aria-hidden />

        <div className="sm:pl-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Contas ativas
          </p>
          <p className="tabular-nums mt-0.5 text-2xl font-bold leading-tight text-[var(--text-primary)] sm:text-3xl">
            {accountCount}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{countHint}</p>
        </div>
      </div>
    </Card>
  );
}

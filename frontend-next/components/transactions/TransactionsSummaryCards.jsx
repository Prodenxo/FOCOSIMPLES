import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PeriodBalanceDecor } from '@/components/illustrations/PeriodBalanceDecor';
import { formatBrl } from '@/lib/format';

function toneLabel(tone) {
  if (tone === 'positive') return 'Positivo';
  if (tone === 'negative') return 'Negativo';
  return 'Neutro';
}

function toneClass(tone) {
  if (tone === 'positive') return 'bg-[var(--accent-soft)] text-[var(--accent)]';
  if (tone === 'negative') return 'bg-[var(--expense-soft)] text-red-500';
  return 'bg-[var(--canvas)] text-[var(--text-muted)]';
}

export function TransactionsSummaryCards({ kpis }) {
  const lancamentosEntrada = kpis.countEntradas === 1 ? '1 lançamento' : `${kpis.countEntradas} lançamentos`;
  const lancamentosSaida = kpis.countSaidas === 1 ? '1 lançamento' : `${kpis.countSaidas} lançamentos`;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="relative overflow-hidden p-6">
        <PeriodBalanceDecor />
        <div className="relative z-[1]">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-sm font-medium text-[var(--text-muted)]">Saldo do período</span>
          </div>
          <p className="tabular-nums text-2xl font-bold text-[var(--text-primary)]">
            {formatBrl(kpis.saldo)}
          </p>
          <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(kpis.saldoTone)}`}>
            {toneLabel(kpis.saldoTone)}
          </span>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <ArrowUpRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-medium text-[var(--text-muted)]">Entradas</span>
        </div>
        <p className="tabular-nums text-2xl font-bold text-[var(--text-primary)]">
          {formatBrl(kpis.entradas)}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{lancamentosEntrada}</p>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--expense-soft)] text-red-500">
            <ArrowDownLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-medium text-[var(--text-muted)]">Saídas</span>
        </div>
        <p className="tabular-nums text-2xl font-bold text-[var(--text-primary)]">
          {formatBrl(kpis.saidas)}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{lancamentosSaida}</p>
      </Card>
    </div>
  );
}

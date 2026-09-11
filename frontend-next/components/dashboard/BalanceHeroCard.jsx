import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BalanceDecorCircles } from '@/components/illustrations/BalanceDecorCircles';
import { formatBrl } from '@/lib/format';

export function BalanceHeroCard({ label, hint, balance, totalIncome, totalExpenses }) {
  return (
    <Card className="relative flex min-h-[256px] flex-col overflow-hidden p-6 lg:p-7">
      <BalanceDecorCircles />

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="mb-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>{label}</span>
          <Info className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <p className="tabular-nums text-[2.875rem] font-bold leading-none tracking-tight text-[var(--text-primary)]">
          {formatBrl(balance)}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{hint}</p>

        <div className="mt-auto grid grid-cols-2 border-t border-[var(--card-border)] pt-5">
          <div className="border-r border-[var(--card-border)] pr-6">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <ArrowUpRight className="h-4 w-4 text-[var(--accent)]" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">Entradas</span>
            </div>
            <p className="tabular-nums text-lg font-semibold text-[var(--text-primary)]">
              {formatBrl(totalIncome)}
            </p>
          </div>
          <div className="pl-6">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--expense-soft)]">
                <ArrowDownLeft className="h-4 w-4 text-red-500" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">Saídas</span>
            </div>
            <p className="tabular-nums text-lg font-semibold text-[var(--text-primary)]">
              {formatBrl(totalExpenses)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

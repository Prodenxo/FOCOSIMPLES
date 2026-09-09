'use client';

import { Card } from '@/components/ui/Card';
import { CategoryTagsIllustration } from '@/components/illustrations/CategoryTagsIllustration';
import { formatBrl } from '@/lib/format';

function DecorCircles() {
  return (
    <svg
      width="100"
      height="80"
      viewBox="0 0 100 80"
      fill="none"
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50"
      aria-hidden="true"
    >
      <circle cx="62" cy="40" r="36" fill="var(--accent-soft)" opacity="0.35" />
      <circle cx="62" cy="40" r="22" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
  );
}

export function CategorySummaryCard({
  viewTipo,
  totalMonth,
  monthLabel,
  categoryCount,
  activeCount,
  loading,
}) {
  const label = viewTipo === 'saida' ? 'Total de saídas' : 'Total de entradas';
  const valueColor = viewTipo === 'saida' ? 'text-red-500' : 'text-[var(--accent)]';

  return (
    <Card className="relative overflow-hidden p-0">
      <DecorCircles />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <CategoryTagsIllustration size={64} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {label}
            </p>
            <p className={`tabular-nums mt-0.5 text-2xl font-bold leading-tight sm:text-3xl ${valueColor}`}>
              {loading ? '…' : formatBrl(totalMonth)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{monthLabel}</p>
          </div>
        </div>
        <div className="flex gap-6 sm:shrink-0 sm:justify-end">
          <div className="text-center sm:text-right">
            <p className="tabular-nums text-xl font-bold text-[var(--text-primary)]">{categoryCount}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {categoryCount === 1 ? 'Categoria' : 'Categorias'}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="tabular-nums text-xl font-bold text-[var(--text-primary)]">{activeCount}</p>
            <p className="text-xs text-[var(--text-muted)]">Com movimento</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

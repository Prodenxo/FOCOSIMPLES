'use client';

import Link from 'next/link';
import { Tag } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyPieChartIllustration } from '@/components/illustrations/EmptyPieChartIllustration';
import { formatBrl, formatPct } from '@/lib/format';
import { getCategorySliceColorForId } from '@/lib/categoryColors';
import { getCategoryIconComponent } from '@/lib/categoryIcons';

function CategoryDonut({ segments, size = 120 }) {
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--card-border)"
        strokeWidth={stroke}
      />
      {segments.map((seg, i) => {
        const dash = seg.ratio * circumference;
        const el = (
          <circle
            key={seg.id}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export function CategoryDistributionPanel({ viewTipo, monthRef, rowsWithMovement, totalMonth }) {
  const positiveRows = rowsWithMovement.filter((row) => row.amount > 0);
  const hasEligibleMovement = rowsWithMovement.some((row) => row.hasMovement);
  const allZero = hasEligibleMovement && positiveRows.length === 0;

  const positiveTotal = positiveRows.reduce((sum, row) => sum + row.amount, 0);
  const chartBase = positiveTotal > 0 ? positiveTotal : totalMonth;

  const segments =
    chartBase > 0 && positiveRows.length > 0
      ? positiveRows.slice(0, 8).map((row) => ({
          id: row.id,
          ratio: Math.min(1, row.amount / chartBase),
          color: getCategorySliceColorForId(row.id),
        }))
      : [];

  const emptyTitle =
    viewTipo === 'saida' ? 'Nenhuma saída neste mês' : 'Nenhuma entrada neste mês';

  const txHref = `/transacoes?tipo=${viewTipo}&year=${monthRef.year}&month=${monthRef.month}`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Distribuição do mês</h2>

        {!hasEligibleMovement ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="relative mb-4">
              <div
                className="pointer-events-none absolute inset-0 scale-125 rounded-full bg-[var(--accent-soft)] opacity-60"
                aria-hidden
              />
              <EmptyPieChartIllustration className="relative" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{emptyTitle}</p>
            <p className="mt-1 max-w-[260px] text-sm text-[var(--text-muted)]">
              As categorias com movimentações aparecerão aqui.
            </p>
            <Link
              href={txHref}
              className="mt-5 inline-flex h-10 items-center rounded-[14px] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Ver transações
            </Link>
          </div>
        ) : allZero || segments.length === 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[var(--text-muted)]">
              Movimentações encontradas, porém o total líquido do mês é zero.
            </p>
            <ul className="divide-y divide-[var(--card-border)]">
              {rowsWithMovement.map((row) => {
                const Icon = getCategoryIconComponent(row.nome);
                const color = getCategorySliceColorForId(row.id);
                return (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="truncate text-sm text-[var(--text-primary)]">{row.nome}</span>
                    </span>
                    <span className="tabular-nums shrink-0 text-sm font-semibold text-[var(--text-primary)]">
                      {formatBrl(row.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <CategoryDonut segments={segments} />
            <ul className="w-full min-w-0 space-y-2">
              {positiveRows.slice(0, 8).map((row) => {
                const Icon = getCategoryIconComponent(row.nome);
                const color = getCategorySliceColorForId(row.id);
                const pct = chartBase > 0 ? (row.amount / chartBase) * 100 : 0;
                return (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="truncate text-sm text-[var(--text-primary)]">{row.nome}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular-nums block text-sm font-semibold text-[var(--text-primary)]">
                        {formatBrl(row.amount)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{formatPct(pct)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      <Card className="flex items-start gap-3 border-[var(--accent)]/20 bg-[var(--accent-soft)]/35 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Tag className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Tudo no seu lugar</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Use categorias para entender melhor seus gastos.
          </p>
        </div>
      </Card>
    </div>
  );
}

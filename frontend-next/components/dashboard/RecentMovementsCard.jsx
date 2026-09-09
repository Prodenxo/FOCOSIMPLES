import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl } from '@/lib/format';

export function RecentMovementsCard({ items, count }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Últimas movimentações</h2>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">
          {count} {count === 1 ? 'lançamento' : 'lançamentos'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--text-muted)]">
          Nenhum lançamento neste mês.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  item.tipo === 'entrada' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-red-50 text-red-500'
                }`}
              >
                {item.tipo === 'entrada' ? (
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowDownLeft className="h-4 w-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.dateLabel}</p>
              </div>
              <span
                className={`tabular-nums shrink-0 text-sm font-semibold ${
                  item.tipo === 'entrada' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                }`}
              >
                {item.tipo === 'entrada' ? '+' : '−'} {item.amount}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/transacoes"
        className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
      >
        Ver todas →
      </Link>
    </Card>
  );
}

export function MonthMovementsCard({ pagos, aPagar }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Movimentações do mês</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[14px] bg-[var(--canvas)] p-4">
          <p className="text-sm font-medium text-[var(--text-muted)]">Pagos</p>
          <p className="tabular-nums mt-1 text-2xl font-bold text-[var(--accent)]">{formatBrl(pagos)}</p>
        </div>
        <div className="rounded-[14px] bg-[var(--canvas)] p-4">
          <p className="text-sm font-medium text-[var(--text-muted)]">A pagar</p>
          <p className="tabular-nums mt-1 text-2xl font-bold text-red-500">{formatBrl(aPagar)}</p>
        </div>
      </div>
    </Card>
  );
}

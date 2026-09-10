import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { NoMovementsIllustration } from '@/components/illustrations/NoMovementsIllustration';
import { formatBrl } from '@/lib/format';

export function TodayMovementsCard({ todayFlow }) {
  const hasItems = todayFlow.items.length > 0;

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Movimentação de hoje</h2>
        <div className="flex gap-4 text-sm font-medium">
          <span className="text-[var(--accent)]">
            Entradas <span className="tabular-nums">{formatBrl(todayFlow.income)}</span>
          </span>
          <span className="text-red-500">
            Saídas <span className="tabular-nums">{formatBrl(todayFlow.expense)}</span>
          </span>
        </div>
      </div>

      {hasItems ? (
        <ul className="divide-y divide-[var(--card-border)]">
          {todayFlow.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.dateLabel}</p>
              </div>
              <span
                className={`tabular-nums shrink-0 text-sm font-semibold ${
                  item.tipo === 'entrada' ? 'text-[var(--accent)]' : 'text-red-500'
                }`}
              >
                {item.tipo === 'entrada' ? '+' : '−'} {item.amount}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyPanel
          illustration={<NoMovementsIllustration />}
          title="Nenhuma movimentação hoje"
          description="Suas transações do dia aparecerão aqui."
        />
      )}

      {hasItems ? (
        <Link
          href="/transacoes"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Ver todas →
        </Link>
      ) : null}
    </Card>
  );
}

'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { EmptyPieChartIllustration } from '@/components/illustrations/EmptyPieChartIllustration';
import { formatBrl } from '@/lib/format';

function bucketBudgets(items, tab) {
  const filtered = items.filter((item) => item.tipo === tab);
  if (tab === 'entrada') {
    return {
      verde: filtered.filter((i) => i.percentual >= 75),
      amarelo: filtered.filter((i) => i.percentual > 50 && i.percentual < 75),
      laranja: filtered.filter((i) => i.percentual > 25 && i.percentual <= 50),
      vermelho: filtered.filter((i) => i.percentual <= 25),
    };
  }
  return {
    verde: filtered.filter((i) => i.percentual <= 25),
    amarelo: filtered.filter((i) => i.percentual > 25 && i.percentual <= 50),
    laranja: filtered.filter((i) => i.percentual > 50 && i.percentual <= 75),
    vermelho: filtered.filter((i) => i.percentual > 75),
  };
}

export function BudgetCategoriesCard({ budgets, budgetTab, onTabChange }) {
  const buckets = bucketBudgets(budgets, budgetTab);
  const hasAny =
    buckets.verde.length + buckets.amarelo.length + buckets.laranja.length + buckets.vermelho.length > 0;

  const flatList = [...buckets.verde, ...buckets.amarelo, ...buckets.laranja, ...buckets.vermelho]
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 6);

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Categorias por percentual</h2>
        <div
          className="inline-flex rounded-[14px] border border-[var(--card-border)] bg-[var(--canvas)] p-0.5"
          role="tablist"
          aria-label="Tipo de orçamento"
        >
          {['entrada', 'saida'].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={budgetTab === tab}
              onClick={() => onTabChange(tab)}
              className={`rounded-[12px] px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${
                budgetTab === tab
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'entrada' ? 'Entrada' : 'Saída'}
            </button>
          ))}
        </div>
      </div>

      {hasAny ? (
        <ul className="space-y-4">
          {flatList.map((item) => {
            const pct = Math.min(100, Math.max(0, item.percentual));
            const barColor =
              pct <= 25 ? 'bg-[var(--accent)]' :
              pct <= 50 ? 'bg-amber-400' :
              pct <= 75 ? 'bg-orange-400' : 'bg-red-500';
            return (
              <li key={item.categorias_id}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-[var(--text-primary)]">{item.nome}</span>
                  <span className="tabular-nums shrink-0 text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--canvas)]">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular-nums mt-1 text-xs text-[var(--text-muted)]">
                  {formatBrl(item.realizado)} / {formatBrl(item.orcado)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyPanel
          illustration={<EmptyPieChartIllustration />}
          title={`Nenhum orçamento de ${budgetTab === 'entrada' ? 'entrada' : 'saída'} neste mês`}
          description="Crie um orçamento para visualizar a distribuição por categorias."
          action={
            <Link
              href="/orcamentos"
              className="mt-2 inline-flex h-11 items-center rounded-[14px] border border-[var(--accent)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Criar orçamento
            </Link>
          }
        />
      )}
    </Card>
  );
}

'use client';

import { Coins, Target, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl, formatPct } from '@/lib/format';

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, hint, valueClass = '' }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </p>
          <p className={`tabular-nums mt-1 text-2xl font-bold leading-tight ${valueClass || 'text-[var(--text-primary)]'}`}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
        </span>
      </div>
    </Card>
  );
}

export function BudgetSummaryCards({ viewTipo, totals, categoryCount, loading }) {
  const isEntrada = viewTipo === 'entrada';
  const { orcado, realizado, diff, percentExact } = totals;

  const orcadoLabel = isEntrada ? 'Meta de receitas' : 'Total orçado';
  const realizadoLabel = isEntrada ? 'Recebido' : 'Realizado';
  const pctHint =
    orcado > 0 && percentExact != null
      ? `${formatPct(percentExact)} ${isEntrada ? 'da meta' : 'do orçamento'}`
      : 'Sem valores planejados';

  let thirdLabel;
  let thirdValue;
  let thirdHint;
  let thirdValueClass = 'text-[var(--accent)]';

  if (isEntrada) {
    if (realizado > orcado && orcado > 0) {
      thirdLabel = 'Meta superada';
      thirdValue = formatBrl(realizado - orcado);
      thirdHint = 'Acima da meta planejada';
    } else if (orcado > 0 && realizado === orcado) {
      thirdLabel = 'Meta atingida';
      thirdValue = formatBrl(0);
      thirdHint = 'Receita alinhada à meta';
    } else {
      thirdLabel = 'Falta para a meta';
      thirdValue = formatBrl(Math.max(0, diff));
      thirdHint = diff <= 0 && orcado > 0 ? 'Meta atingida ou superada' : 'Ainda a receber no mês';
    }
  } else if (realizado > orcado && orcado > 0) {
    thirdLabel = 'Excedido';
    thirdValue = formatBrl(realizado - orcado);
    thirdHint = 'Acima do limite planejado';
    thirdValueClass = 'text-red-500';
  } else {
    thirdLabel = 'Disponível';
    thirdValue = formatBrl(Math.max(0, diff));
    thirdHint =
      diff === 0 && orcado > 0
        ? 'Limite totalmente utilizado'
        : 'Diferença do orçamento, não saldo bancário';
    thirdValueClass = diff < 0 ? 'text-red-500' : 'text-[var(--accent)]';
  }

  const realizadoClass =
    !isEntrada && orcado > 0 && realizado > orcado ? 'text-red-500' : 'text-[var(--text-primary)]';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--text-muted)]">
        Totais de {categoryCount} {categoryCount === 1 ? 'categoria' : 'categorias'} com{' '}
        {isEntrada ? 'meta' : 'orçamento'} neste mês — independente de busca e filtros da lista.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={Wallet}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          label={orcadoLabel}
          value={loading ? '…' : formatBrl(orcado)}
          hint={`${categoryCount} ${categoryCount === 1 ? 'categoria' : 'categorias'}`}
          valueClass="text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          icon={Target}
          iconBg="bg-[var(--accent-soft)]"
          iconColor="text-[var(--accent)]"
          label={realizadoLabel}
          value={loading ? '…' : formatBrl(realizado)}
          hint={pctHint}
          valueClass={realizadoClass}
        />
        <SummaryCard
          icon={Coins}
          iconBg="bg-[var(--accent-soft)]"
          iconColor="text-[var(--accent)]"
          label={thirdLabel}
          value={loading ? '…' : thirdValue}
          hint={thirdHint}
          valueClass={thirdValueClass}
        />
      </div>
    </div>
  );
}

'use client';

import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BudgetEmptyIllustration } from '@/components/illustrations/BudgetEmptyIllustration';

export function BudgetEmptyState({ viewTipo, onCreate, onCopy }) {
  const title =
    viewTipo === 'saida'
      ? 'Nenhum orçamento de saída neste mês'
      : 'Nenhuma meta de entrada neste mês';

  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <BudgetEmptyIllustration size={240} className="mx-auto" />
      <h2 className="mt-6 text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        Defina limites para suas despesas e metas para suas receitas.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Criar primeiro orçamento
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 text-sm font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
      >
        Copiar de outro mês
      </button>
    </Card>
  );
}

export function BudgetInfoTip({ viewTipo }) {
  const description =
    viewTipo === 'saida'
      ? 'Acompanhe o realizado e veja quanto ainda pode gastar em cada categoria.'
      : 'Acompanhe suas receitas e veja quanto falta para alcançar suas metas.';

  return (
    <Card className="flex items-start gap-3 border-[var(--accent)]/20 bg-[var(--accent-soft)]/35 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </span>
      <div className="text-left">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Um plano para cada mês</p>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
      </div>
    </Card>
  );
}

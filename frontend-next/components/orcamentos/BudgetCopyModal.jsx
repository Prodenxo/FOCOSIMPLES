'use client';

import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatMonthLabelPt } from '@/lib/budgetUtils';

export function BudgetCopyModal({
  open,
  sourceMonth,
  targetMonth,
  sourceCount,
  overwriteCount,
  onConfirm,
  onClose,
  copying,
}) {
  if (!open) return null;

  const sourceLabel = formatMonthLabelPt(sourceMonth);
  const targetLabel = formatMonthLabelPt(targetMonth);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-budget-title"
    >
      <Card className="w-full max-w-md p-6">
        <h2 id="copy-budget-title" className="text-lg font-semibold text-[var(--text-primary)]">
          Copiar orçamentos
        </h2>
        <p className="mt-2 text-sm text-[var(--text-primary)]">
          Copiar valores planejados de <strong>{sourceLabel}</strong> para{' '}
          <strong>{targetLabel}</strong>.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
          <li>{sourceCount} {sourceCount === 1 ? 'categoria com orçamento' : 'categorias com orçamento'} na origem</li>
          <li>Transações e valores realizados não são copiados</li>
          {overwriteCount > 0 ? (
            <li className="text-amber-600 dark:text-amber-400">
              {overwriteCount} {overwriteCount === 1 ? 'orçamento existente será atualizado' : 'orçamentos existentes serão atualizados'} no destino
            </li>
          ) : (
            <li>Nenhum orçamento existente será sobrescrito</li>
          )}
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={copying}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[var(--card-border)] px-4 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={copying || sourceCount === 0}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {copying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Copiando…
              </>
            ) : (
              'Confirmar cópia'
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}

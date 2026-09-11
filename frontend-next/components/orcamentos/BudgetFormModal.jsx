'use client';

import { AppSelect } from '@/components/ui/AppSelect';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { formatMoneyInputFromDigits, normalizeTipo } from '@/lib/budgetUtils';
import { getCategoryIconComponent } from '@/lib/categoryIcons';
import { getCategorySliceColorForId } from '@/lib/categoryColors';

export function BudgetFormModal({
  open,
  categorias,
  viewTipo,
  editingRow,
  monthLabel,
  onClose,
  onSubmit,
  saving,
  error,
}) {
  const [categoryId, setCategoryId] = useState('');
  const [valorDigits, setValorDigits] = useState('');
  const [localError, setLocalError] = useState('');

  const isEdit = Boolean(editingRow);
  const availableCategories = useMemo(() => {
    const filtered = categorias.filter((c) => normalizeTipo(c.tipo) === viewTipo);
    if (isEdit) return filtered;
    return filtered;
  }, [categorias, viewTipo, isEdit]);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    if (editingRow) {
      setCategoryId(String(editingRow.id));
      const cents = Math.round((editingRow.orcado || 0) * 100);
      setValorDigits(cents > 0 ? String(cents) : '');
    } else {
      setCategoryId('');
      setValorDigits('');
    }
  }, [open, editingRow]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    const catId = Number(categoryId);
    if (!catId) {
      setLocalError('Selecione uma categoria.');
      return;
    }
    if (!valorDigits) {
      setLocalError('Informe o valor do orçamento.');
      return;
    }
    const parsed = Number(valorDigits) / 100;
    if (Number.isNaN(parsed) || parsed < 0) {
      setLocalError('Informe um valor numérico válido.');
      return;
    }
    try {
      await onSubmit({ categorias_id: catId, valor_orcado: parsed });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar orçamento.');
    }
  };

  const displayError = localError || error;
  const valueLabel = viewTipo === 'entrada' ? 'Meta de receita' : 'Valor orçado';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {isEdit ? 'Orçamento' : 'Planejamento'}
            </p>
            <h2 id="budget-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
              {isEdit ? 'Editar orçamento' : 'Novo orçamento'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{monthLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!saving) onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)]"
            aria-label="Fechar formulário"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="budget-categoria" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Categoria
            </label>
            {isEdit && editingRow ? (
              <div className="flex items-center gap-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5">
                {(() => {
                  const Icon = getCategoryIconComponent(editingRow.nome);
                  const color = getCategorySliceColorForId(editingRow.id);
                  return (
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  );
                })()}
                <span className="text-sm font-semibold text-[var(--text-primary)]">{editingRow.nome}</span>
              </div>
            ) : (
              <AppSelect
                ariaLabel="Categoria do orçamento"
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Selecione…"
                options={[
                  { value: '', label: 'Selecione…' },
                  ...availableCategories.map((cat) => ({
                    value: String(cat.id),
                    label: cat.nome,
                  })),
                ]}
              />
            )}
          </div>

          <div>
            <label htmlFor="budget-valor" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {valueLabel}
            </label>
            <input
              id="budget-valor"
              type="text"
              inputMode="numeric"
              value={formatMoneyInputFromDigits(valorDigits)}
              onChange={(e) => setValorDigits(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: R$ 1.500,00"
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {displayError ? (
            <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--card-border)] px-5 py-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              'Salvar orçamento'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

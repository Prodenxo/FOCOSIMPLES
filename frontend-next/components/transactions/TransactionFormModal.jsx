'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { normalizarTipo } from '@/lib/dashboardUtils';
import {
  formatCurrencyInput,
  isoToBrDate,
  normalizeStatusForSave,
  parseBrDateToIso,
  parseCurrencyInput,
} from '@/lib/transactionUtils';

const EMPTY = {
  tipo: 'saida',
  valor: '',
  classificacao: '',
  data: '',
  statusRealized: true,
  obs: '',
  conta_id: '',
};

export function TransactionFormModal({
  open,
  onClose,
  draft,
  categories,
  contas,
  onSubmit,
  saving,
  error,
}) {
  const [form, setForm] = useState(EMPTY);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    if (!draft) {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setForm({ ...EMPTY, data: isoToBrDate(iso) });
      return;
    }

    const isEntrada = normalizarTipo(draft.tipo) === 'entrada';
    const status = String(draft.status || '').toLowerCase();
    const realized = status === 'pago' || status === 'recebido';
    const iso = draft.data ? String(draft.data).slice(0, 10) : '';

    setForm({
      tipo: isEntrada ? 'entrada' : 'saida',
      valor: formatCurrencyInput(Number(draft.valor) || 0),
      classificacao: String(draft.classificacao || ''),
      data: iso ? isoToBrDate(iso) : '',
      statusRealized: realized,
      obs: String(draft.obs || ''),
      conta_id: draft.conta_id ? String(draft.conta_id) : '',
    });
  }, [open, draft]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => normalizarTipo(c.tipo) === form.tipo),
    [categories, form.tipo],
  );

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const iso = parseBrDateToIso(form.data);
    const valor = parseCurrencyInput(form.valor);
    if (!form.classificacao.trim()) {
      setLocalError('Selecione uma categoria.');
      return;
    }
    if (!iso) {
      setLocalError('Informe uma data válida (dd/mm/aaaa).');
      return;
    }
    if (valor <= 0) {
      setLocalError('Informe um valor válido.');
      return;
    }
    setLocalError('');

    await onSubmit({
      tipo: form.tipo,
      valor,
      classificacao: form.classificacao.trim(),
      data: iso,
      status: normalizeStatusForSave(form.tipo, form.statusRealized),
      obs: form.obs.trim() || null,
      conta_id: form.conta_id || null,
    });
  };

  const title = draft?.id && !draft?._draftDuplicate
    ? 'Editar transação'
    : draft?._draftDuplicate
      ? 'Duplicar transação'
      : 'Nova transação';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="app-scrollbar max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] bg-[var(--card-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-[var(--canvas)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="inline-flex rounded-[14px] border border-[var(--card-border)] bg-[var(--canvas)] p-0.5">
            {['entrada', 'saida'].map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo, classificacao: '' }))}
                className={`rounded-[12px] px-4 py-2 text-sm font-semibold ${
                  form.tipo === tipo ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'
                }`}
              >
                {tipo === 'entrada' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Valor</span>
            <input
              required
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: formatCurrencyInput(parseCurrencyInput(e.target.value)) }))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
              placeholder="R$ 0,00"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Categoria</span>
            <select
              required
              value={form.classificacao}
              onChange={(e) => setForm((f) => ({ ...f, classificacao: e.target.value }))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
            >
              <option value="">Selecione…</option>
              {filteredCategories.map((c) => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Conta</span>
            <select
              value={form.conta_id}
              onChange={(e) => setForm((f) => ({ ...f, conta_id: e.target.value }))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
            >
              <option value="">Sem conta</option>
              {contas.filter((c) => c.ativo).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Data (dd/mm/aaaa)</span>
            <input
              required
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              placeholder="dd/mm/aaaa"
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Status</span>
            <select
              value={form.statusRealized ? 'realizado' : 'pendente'}
              onChange={(e) => setForm((f) => ({ ...f, statusRealized: e.target.value === 'realizado' }))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
            >
              <option value="realizado">{form.tipo === 'entrada' ? 'Recebido' : 'Pago'}</option>
              <option value="pendente">{form.tipo === 'entrada' ? 'A receber' : 'A pagar'}</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Observação</span>
            <textarea
              value={form.obs}
              onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value.slice(0, 500) }))}
              rows={3}
              className="w-full rounded-[14px] border border-[var(--card-border)] px-3 py-2"
            />
          </label>

          {localError || error ? (
            <p className="rounded-[14px] bg-[var(--expense-soft)] px-3 py-2 text-sm text-red-600">{localError || error}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </button>
        </form>
      </div>
    </div>
  );
}

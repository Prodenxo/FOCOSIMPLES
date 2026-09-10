'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import { normalizarTipo } from '@/lib/dashboardUtils';
import {
  formatCurrencyInput,
  normalizeStatusForSave,
  parseCurrencyInput,
} from '@/lib/transactionUtils';

export function RecorrenciaFormModal({
  open,
  onClose,
  recorrencia,
  categories,
  onSave,
  saving,
  error,
}) {
  const [diaMes, setDiaMes] = useState('5');
  const [tipo, setTipo] = useState('saida');
  const [valor, setValor] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [statusRealized, setStatusRealized] = useState(true);
  const [obs, setObs] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    if (!recorrencia) {
      setDiaMes('5');
      setTipo('saida');
      setValor('');
      setClassificacao('');
      setStatusRealized(true);
      setObs('');
      setAtivo(true);
      return;
    }
    const isEntrada = normalizarTipo(recorrencia.tipo) === 'entrada';
    setDiaMes(String(recorrencia.dia_do_mes));
    setTipo(isEntrada ? 'entrada' : 'saida');
    setValor(formatCurrencyInput(Number(recorrencia.valor) || 0));
    setClassificacao(String(recorrencia.classificacao || ''));
    const st = String(recorrencia.status || '').toLowerCase();
    setStatusRealized(st === 'pago' || st === 'recebido');
    setObs(String(recorrencia.obs || ''));
    setAtivo(Boolean(recorrencia.ativo));
  }, [open, recorrencia]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => normalizarTipo(c.tipo) === tipo),
    [categories, tipo],
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Selecione…' },
      ...filteredCategories.map((c) => ({ value: c.nome, label: c.nome })),
    ],
    [filteredCategories],
  );

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const d = parseInt(diaMes, 10);
    if (Number.isNaN(d) || d < 1 || d > 31) {
      setLocalError('Informe o dia do mês entre 1 e 31.');
      return;
    }
    if (!classificacao.trim()) {
      setLocalError('Selecione uma categoria.');
      return;
    }
    const valorNum = parseCurrencyInput(valor);
    if (valorNum <= 0) {
      setLocalError('Informe um valor válido.');
      return;
    }
    setLocalError('');
    await onSave({
      id: recorrencia?.id,
      dia_do_mes: d,
      valor: valorNum,
      classificacao: classificacao.trim(),
      tipo,
      status: normalizeStatusForSave(tipo, statusRealized),
      obs: obs.trim() || null,
      categoria: classificacao.trim(),
      ativo,
    });
  };

  const title = recorrencia ? 'Editar recorrência' : 'Nova recorrência';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
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
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Dia do mês (1–31)</span>
            <input
              value={diaMes}
              onChange={(e) => setDiaMes(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
              inputMode="numeric"
            />
          </label>

          <div className="inline-flex rounded-[14px] border border-[var(--card-border)] bg-[var(--canvas)] p-0.5">
            {['entrada', 'saida'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`rounded-[12px] px-4 py-2 text-sm font-semibold ${
                  tipo === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'
                }`}
              >
                {t === 'entrada' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Valor</span>
            <input
              value={valor}
              onChange={(e) => setValor(formatCurrencyInput(parseCurrencyInput(e.target.value)))}
              className="h-11 w-full rounded-[14px] border border-[var(--card-border)] px-3"
            />
          </label>

          <AppSelect
            label="Categoria"
            value={classificacao}
            onChange={setClassificacao}
            options={categoryOptions}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={statusRealized}
              onChange={(e) => setStatusRealized(e.target.checked)}
            />
            <span>{tipo === 'entrada' ? 'Marcar como recebido' : 'Marcar como pago'}</span>
          </label>

          {recorrencia ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              <span>Recorrência ativa</span>
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--text-muted)]">Observação</span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value.slice(0, 500))}
              rows={2}
              className="w-full rounded-[14px] border border-[var(--card-border)] px-3 py-2"
            />
          </label>

          {localError || error ? (
            <p className="rounded-[14px] bg-[var(--expense-soft)] px-3 py-2 text-sm text-red-600">
              {localError || error}
            </p>
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

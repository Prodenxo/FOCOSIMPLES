'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { mergeCurrencyCatalog } from '@/lib/frankfurterCurrenciesFallback';
import {
  formatMoedaValorForInput,
  formatMoedaValorInput,
  getMoedaFractionDigits,
  parseMoedaValorInput,
} from '@/lib/moedaFormat';
import { prefetchMoedaCotacao } from '@/lib/moedasGlobaisService';
import { MoedaPickerField } from './MoedaPickerField';

export function ContaMoedaFormModal({
  open,
  conta,
  currencyCatalog,
  catalogLoading,
  registeredMoedas = [],
  onClose,
  onSubmit,
  saving,
  error,
}) {
  const [moeda, setMoeda] = useState('USD');
  const [nome, setNome] = useState('');
  const [valorStr, setValorStr] = useState('');
  const [localError, setLocalError] = useState('');

  const catalog = useMemo(() => mergeCurrencyCatalog(currencyCatalog), [currencyCatalog]);
  const isEdit = Boolean(conta?.id);
  const fractionDigits = getMoedaFractionDigits(moeda);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    if (conta) {
      setMoeda(conta.moeda);
      setNome(conta.nome || '');
      setValorStr(formatMoedaValorForInput(conta.valor, conta.moeda));
    } else {
      setMoeda('USD');
      setNome('');
      setValorStr('');
    }
  }, [open, conta]);

  useEffect(() => {
    if (!open || !moeda) return;
    prefetchMoedaCotacao(moeda);
  }, [open, moeda]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    const code = moeda.trim().toUpperCase();
    if (code.length !== 3) {
      setLocalError('Selecione uma moeda válida (código de 3 letras).');
      return;
    }
    const duplicate =
      registeredMoedas.includes(code) && (!isEdit || conta?.moeda !== code);
    if (duplicate) {
      setLocalError(`Você já possui saldo cadastrado em ${code}. Edite o registro existente.`);
      return;
    }
    const valor = parseMoedaValorInput(valorStr);
    if (!Number.isFinite(valor) || valor < 0) {
      setLocalError('Informe um valor válido.');
      return;
    }
    await onSubmit(
      {
        moeda: code,
        nome: nome.trim() || null,
        valor,
      },
      conta?.id,
    );
  };

  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moeda-modal-title"
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
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {isEdit ? 'Conta global' : 'Cadastro'}
            </p>
            <h2 id="moeda-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
              {isEdit ? 'Editar moeda' : 'Adicionar moeda'}
            </h2>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 app-scrollbar">
          <MoedaPickerField
            value={moeda}
            onChange={(code) => {
              setMoeda(code);
              if (!isEdit) setValorStr('');
            }}
            catalog={catalog}
            loading={catalogLoading}
          />

          <div>
            <label htmlFor="moeda-nome" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Apelido (opcional)
            </label>
            <input
              id="moeda-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Wise, PayPal, conta EUA…"
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div>
            <label htmlFor="moeda-valor" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Quanto você tem hoje
            </label>
            <input
              id="moeda-valor"
              type="text"
              inputMode="decimal"
              value={valorStr}
              onChange={(e) => setValorStr(formatMoedaValorInput(e.target.value, fractionDigits))}
              placeholder={fractionDigits === 3 ? '0,000' : '0,00'}
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5 text-sm tabular-nums text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Informe o valor na moeda escolhida. O equivalente em reais é só referência.
            </p>
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
              'Salvar'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

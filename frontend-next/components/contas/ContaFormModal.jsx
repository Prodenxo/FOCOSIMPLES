'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { CUSTOM_BANK_ID, findBankById, findBankByNome } from '@/lib/bankCatalog';
import { DEFAULT_CONTA_NOME } from '@/lib/contaFinanceiraDefault';
import {
  CONTA_COR_PRESETS,
  CONTA_TIPO_OPTIONS,
} from '@/lib/contaFinanceiraTypes';
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/lib/transactionUtils';
import { BankIcon } from './BankIcon';
import { BankPickerGrid } from './BankPickerGrid';

function formatSaldoDisplay(value) {
  const n = typeof value === 'number' ? value : 0;
  return formatCurrencyInput(n);
}

function parseDia(value) {
  if (!String(value || '').trim()) return null;
  const n = parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

export function ContaFormModal({ open, conta, onClose, onSubmit, saving, error }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('corrente');
  const [saldoStr, setSaldoStr] = useState('R$ 0,00');
  const [limiteStr, setLimiteStr] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [cor, setCor] = useState(CONTA_COR_PRESETS[0]);
  const [instituicaoId, setInstituicaoId] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [showBankPicker, setShowBankPicker] = useState(true);
  const [localError, setLocalError] = useState('');

  const isCustomAccount = selectedBankId === CUSTOM_BANK_ID;
  const isCatalogAccount = selectedBankId != null && selectedBankId !== CUSTOM_BANK_ID;
  const selectedBank = findBankById(selectedBankId);
  const isCartao = tipo === 'cartao_credito';
  const isEdit = Boolean(conta?.id);

  useEffect(() => {
    if (!open) return;
    setLocalError('');

    if (conta) {
      setNome(conta.nome);
      setTipo(conta.tipo);
      setSaldoStr(formatSaldoDisplay(conta.saldo_inicial));
      setLimiteStr(conta.limite_credito != null ? formatSaldoDisplay(conta.limite_credito) : '');
      setDiaFechamento(conta.dia_fechamento != null ? String(conta.dia_fechamento) : '');
      setDiaVencimento(conta.dia_vencimento != null ? String(conta.dia_vencimento) : '');
      setCor(conta.cor || CONTA_COR_PRESETS[0]);
      const bank = findBankById(conta.instituicao_id) ?? findBankByNome(conta.nome);
      if (bank) {
        setSelectedBankId(bank.id);
        setInstituicaoId(bank.id);
        setShowBankPicker(false);
      } else {
        setSelectedBankId(CUSTOM_BANK_ID);
        setInstituicaoId(conta.instituicao_id);
        setShowBankPicker(false);
      }
      return;
    }

    setNome(DEFAULT_CONTA_NOME);
    setTipo('dinheiro');
    setSaldoStr('R$ 0,00');
    setLimiteStr('');
    setDiaFechamento('');
    setDiaVencimento('');
    setCor(CONTA_COR_PRESETS[0]);
    setInstituicaoId(null);
    setSelectedBankId(null);
    setShowBankPicker(true);
  }, [open, conta]);

  const applyBank = (bank) => {
    setSelectedBankId(bank.id);
    setInstituicaoId(bank.id);
    setNome(bank.nome);
    setCor(bank.cor);
    if (bank.defaultTipo) setTipo(bank.defaultTipo);
    setShowBankPicker(false);
  };

  const applyCustom = () => {
    setSelectedBankId(CUSTOM_BANK_ID);
    setInstituicaoId(null);
    setNome((prev) => prev.trim() || DEFAULT_CONTA_NOME);
    setTipo('dinheiro');
    setShowBankPicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!isEdit && !selectedBankId) {
      setLocalError('Escolha um banco na lista ou toque em "Outra conta".');
      return;
    }

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setLocalError('Informe um nome para a conta.');
      return;
    }

    const saldo = parseCurrencyInput(saldoStr);
    if (saldo == null || Number.isNaN(saldo)) {
      setLocalError('Saldo inicial inválido.');
      return;
    }

    let limite = null;
    if (isCartao && limiteStr.trim()) {
      limite = parseCurrencyInput(limiteStr);
      if (limite == null || Number.isNaN(limite)) {
        setLocalError('Limite do cartão inválido.');
        return;
      }
    }

    const payload = {
      nome: nomeTrim,
      tipo,
      saldo_inicial: saldo,
      limite_credito: isCartao ? limite : null,
      dia_fechamento: isCartao ? parseDia(diaFechamento) : null,
      dia_vencimento: isCartao ? parseDia(diaVencimento) : null,
      cor,
      instituicao_id: isCatalogAccount ? instituicaoId : null,
      ativo: true,
    };

    await onSubmit(payload, conta?.id);
  };

  const title = isEdit ? 'Editar conta' : 'Nova conta';

  if (!open) return null;

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
        className="app-scrollbar flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[14px] bg-[var(--card-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 hover:bg-[var(--canvas)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {(!isEdit || showBankPicker) ? (
              <BankPickerGrid
                selectedBankId={selectedBankId}
                onSelectBank={applyBank}
                onSelectCustom={applyCustom}
              />
            ) : null}

            {selectedBankId && !showBankPicker ? (
              <button
                type="button"
                onClick={() => setShowBankPicker(true)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-3 text-left"
              >
                <BankIcon
                  instituicaoId={isCatalogAccount ? instituicaoId : null}
                  nome={nome}
                  cor={cor}
                  size={40}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                    {isCustomAccount ? nome.trim() || 'Conta personalizada' : selectedBank?.nome ?? nome}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">Toque para trocar</span>
                </span>
                <RefreshCw className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
              </button>
            ) : null}

            {isCustomAccount || (isEdit && !isCatalogAccount) ? (
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--text-muted)]">Nome da conta</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Carteira, Cofre, Visa empresa"
                  className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3"
                />
              </label>
            ) : null}

            <div>
              <span className="mb-2 block text-[var(--text-muted)]">Tipo</span>
              <div className="flex flex-wrap gap-2">
                {CONTA_TIPO_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setTipo(o.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      tipo === o.key
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--card-border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-[var(--text-muted)]">
                {isCartao ? 'Fatura atual / saldo' : 'Saldo inicial'}
              </span>
              <input
                required
                value={saldoStr}
                onChange={(e) => setSaldoStr(formatCurrencyInput(parseCurrencyInput(e.target.value)))}
                className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3"
                placeholder="R$ 0,00"
              />
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                {isCartao
                  ? 'Use valor negativo se a fatura estiver em aberto.'
                  : 'Valor no dia em que você passou a usar o app.'}
              </span>
            </label>

            {isCartao ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--text-muted)]">Limite (opcional)</span>
                  <input
                    value={limiteStr}
                    onChange={(e) => setLimiteStr(formatCurrencyInput(parseCurrencyInput(e.target.value)))}
                    className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3"
                    placeholder="R$ 0,00"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-[var(--text-muted)]">Fechamento (dia)</span>
                    <input
                      value={diaFechamento}
                      onChange={(e) => setDiaFechamento(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3"
                      placeholder="1–31"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-[var(--text-muted)]">Vencimento (dia)</span>
                    <input
                      value={diaVencimento}
                      onChange={(e) => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3"
                      placeholder="1–31"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </>
            ) : null}

            <div>
              <span className="mb-2 block text-[var(--text-muted)]">Cor</span>
              <div className="flex flex-wrap gap-2">
                {CONTA_COR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={cor === c}
                    className={`h-8 w-8 rounded-full ${cor === c ? 'ring-2 ring-[var(--accent)] ring-offset-2' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {localError || error ? (
              <p className="rounded-[12px] bg-[var(--expense-soft)] px-3 py-2 text-sm text-red-600">
                {localError || error}
              </p>
            ) : null}
          </div>

          <div className="sticky bottom-0 mt-4 border-t border-[var(--card-border)] bg-[var(--card-bg)] pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {saving ? 'Salvando…' : 'Salvar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

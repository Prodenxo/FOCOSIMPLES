'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl } from '@/lib/format';
import { findBankById, findBankByNome, resolveContaAccent } from '@/lib/bankCatalog';
import { CONTA_TIPO_LABELS } from '@/lib/contaFinanceiraTypes';
import { BankIcon } from './BankIcon';

function HeaderDecor({ accent }) {
  return (
    <svg
      width="80"
      height="64"
      viewBox="0 0 80 64"
      fill="none"
      className="pointer-events-none absolute right-2 top-2 opacity-40"
      aria-hidden="true"
    >
      <circle cx="56" cy="28" r="24" fill={accent} fillOpacity="0.12" />
      <circle cx="56" cy="28" r="14" stroke={accent} strokeOpacity="0.25" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function ContaCard({
  conta,
  saldo,
  isDefault,
  onEdit,
  onDelete,
}) {
  const bank = findBankById(conta.instituicao_id) ?? findBankByNome(conta.nome);
  const accent = resolveContaAccent(conta);
  const bankLabel = bank?.nome;
  const showBankLabel = bankLabel && bankLabel.toLowerCase() !== conta.nome.toLowerCase();
  const saldoColor = saldo >= 0 ? 'text-[var(--text-primary)]' : 'text-red-500';

  return (
    <Card className="flex w-full max-w-[440px] flex-col overflow-hidden p-0">
      <div
        className="relative px-4 pb-3 pt-4"
        style={{ backgroundColor: `${accent}14` }}
      >
        <HeaderDecor accent={accent} />
        <div className="relative flex items-start gap-3">
          <BankIcon
            instituicaoId={conta.instituicao_id}
            nome={conta.nome}
            cor={accent}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold text-[var(--text-primary)]" title={conta.nome}>
                {conta.nome}
              </h3>
              {isDefault ? (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    color: accent,
                    backgroundColor: `${accent}22`,
                    border: `1px solid ${accent}44`,
                  }}
                >
                  Padrão
                </span>
              ) : null}
            </div>
            {showBankLabel ? (
              <p className="truncate text-xs text-[var(--text-muted)]" title={bankLabel}>
                {bankLabel}
              </p>
            ) : null}
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {CONTA_TIPO_LABELS[conta.tipo] || conta.tipo}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)]">Saldo atual</p>
          <p className={`tabular-nums mt-0.5 text-2xl font-bold leading-tight ${saldoColor}`}>
            {formatBrl(saldo)}
          </p>
          {conta.tipo === 'cartao_credito' && conta.limite_credito != null ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Limite {formatBrl(conta.limite_credito)}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            conta.ativo
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'bg-[var(--canvas)] text-[var(--text-muted)]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${conta.ativo ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'}`}
            aria-hidden
          />
          {conta.ativo ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--card-border)] px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar conta
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Excluir
        </button>
      </div>
    </Card>
  );
}

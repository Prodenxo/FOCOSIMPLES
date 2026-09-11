'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/fiscalFormat';
import { Card } from '@/components/ui/Card';

function labelForBanda(banda) {
  switch (banda) {
    case 'seguro': return 'Confortável';
    case 'atencao': return 'Atenção';
    case 'critico': return 'Crítico';
    default: return 'Indeterminado';
  }
}

function messageForBanda(banda) {
  switch (banda) {
    case 'seguro':
      return 'Receita bruta confortável face ao limite anual do Simples Nacional.';
    case 'atencao':
      return 'Você já utilizou grande parte do limite anual de R$ 4,8 milhões.';
    case 'critico':
      return 'Próximo do teto do Simples — planeje o enquadramento e consulte um contador.';
    default:
      return 'Limite de referência ou percentual não disponível para este período.';
  }
}

function bandaToneClass(banda) {
  switch (banda) {
    case 'seguro': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'atencao': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'critico': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';
  }
}

function barColorClass(banda) {
  switch (banda) {
    case 'seguro': return 'bg-emerald-500';
    case 'atencao': return 'bg-amber-500';
    case 'critico': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

function formatPercent(p) {
  if (p === null || !Number.isFinite(p)) return '—';
  return `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

export function LimiteFaturamentoCard({
  anoCivil,
  progresso,
  vigenciaLabel,
  loading = false,
}) {
  const showBar = progresso.limiteReferenciaReais != null
    && progresso.limiteReferenciaReais > 0
    && progresso.percentualUtilizadoParaBarra != null;

  const sublimite = progresso.sublimiteReais;
  const showSublimiteMarker = showBar
    && sublimite != null
    && sublimite > 0
    && progresso.limiteReferenciaReais > 0;
  const sublimiteLeftPct = showSublimiteMarker
    ? Math.min(100, Math.max(0, (sublimite / progresso.limiteReferenciaReais) * 100))
    : 0;

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Limite de faturamento · {anoCivil}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            Simples Nacional
          </h2>
          {vigenciaLabel ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{vigenciaLabel}</p>
          ) : null}
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${bandaToneClass(progresso.banda)}`}>
          {labelForBanda(progresso.banda)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Utilizado no ano</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
            {formatCurrencyBRL(progresso.totalUtilizadoReais)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Limite de referência</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
            {progresso.limiteReferenciaReais != null
              ? formatCurrencyBRL(progresso.limiteReferenciaReais)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Percentual</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
            {formatPercent(progresso.percentualUtilizado)}
          </p>
        </div>
      </div>

      {showBar ? (
        <div className="relative mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--canvas)]">
            <div
              className={`h-full rounded-full transition-all ${barColorClass(progresso.banda)}`}
              style={{ width: `${progresso.percentualUtilizadoParaBarra}%` }}
            />
          </div>
          {showSublimiteMarker ? (
            <div
              className="absolute top-0 h-2.5 w-0.5 bg-[var(--text-muted)]"
              style={{ left: `${sublimiteLeftPct}%` }}
              title={`Sublimite ICMS/ISS: ${formatCurrencyBRL(sublimite)}`}
            />
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-[var(--text-muted)]">
        {messageForBanda(progresso.banda)}
      </p>

      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {progresso.notasConsideradas} nota{progresso.notasConsideradas === 1 ? '' : 's'} autorizada{progresso.notasConsideradas === 1 ? '' : 's'} considerada{progresso.notasConsideradas === 1 ? '' : 's'}.
      </p>

      <div className="mt-4">
        <Link
          href="/notas/notas-fiscais"
          className="text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Ver notas emitidas →
        </Link>
      </div>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--card-bg)]/70 backdrop-blur-[1px]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" aria-hidden />
        </div>
      ) : null}
    </Card>
  );
}

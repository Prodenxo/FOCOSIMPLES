'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { fetchOpenaiUsage } from '@/lib/openaiUsageService';

const PERIODS = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
];

const CHANNELS = [
  { id: 'deepseek', title: 'DeepSeek', subtitle: 'Robô do site' },
  { id: 'openai', title: 'OpenAI', subtitle: 'Transcrição de áudio' },
  { id: 'openclaw', title: 'OpenClaw', subtitle: 'Demais clientes' },
];

function formatBrl(value) {
  return (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function OpenaiUsageModal({ open, onClose }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchOpenaiUsage(period)
      .then((dashboard) => {
        if (!cancelled) setData(dashboard);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar o consumo.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, period]);

  const channels = useMemo(() => {
    const map = new Map((data?.byProvider || []).map((row) => [row.provider, row]));
    return CHANNELS.map(({ id, title, subtitle }) => ({
      id,
      title,
      subtitle,
      row: map.get(id) || { calls: 0, tokens: 0, costBrl: 0, costUsd: 0 },
    }));
  }, [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Consumo de IA"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Consumo de IA</h3>
            <p className="text-xs text-[var(--text-muted)]">Estimativa em reais · Acesso restrito</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[var(--canvas)]" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-[var(--card-border)] px-5 py-3">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                period === p.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--canvas)] text-[var(--text-muted)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            </div>
          ) : error ? (
            <p className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </p>
          ) : data ? (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Total estimado</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatBrl(data.totals?.costBrl)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {data.totals?.calls || 0} chamadas · câmbio {data.usdBrlSource || '—'} ({data.usdBrl})
                </p>
                {data.note ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{data.note}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {channels.map(({ id, title, subtitle, row }) => (
                  <div key={id} className="rounded-[12px] border border-[var(--card-border)] p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatBrl(row.costBrl)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {row.calls > 0 ? `${row.calls} chamada(s)` : 'Sem uso neste período'}
                    </p>
                  </div>
                ))}
              </div>

              {data.recentLogs?.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Registros recentes
                  </p>
                  <ul className="divide-y divide-[var(--card-border)] rounded-[12px] border border-[var(--card-border)]">
                    {data.recentLogs.slice(0, 8).map((log, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-[var(--text-primary)]">
                          {log.source} · {log.model}
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                          {formatBrl(log.costBrl)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

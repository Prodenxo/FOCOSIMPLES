'use client';

import { ChevronRight } from 'lucide-react';
import { formatShortDatePt } from '@/lib/agendaUtils';

export function AgendaUpcoming({ events, onSelect }) {
  if (!events.length) {
    return (
      <div className="rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Próximos dias</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Nenhum compromisso nos próximos dias após a data selecionada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">Próximos dias</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Compromissos reais após o dia selecionado (até 90 dias).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => {
          const dateKey = ev.dateKeys.find((k) => k) || ev.dateKey;
          return (
            <button
              key={`${ev.source}-${ev.id}-${dateKey}`}
              type="button"
              onClick={() => onSelect(ev, dateKey)}
              className="flex items-center gap-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)]/40 px-3 py-3 text-left hover:border-[var(--accent)]/40"
            >
              <div
                className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-tight"
                style={{ backgroundColor: `${ev.color}18`, color: ev.color }}
              >
                <span>{formatShortDatePt(dateKey)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{ev.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {ev.timeLabel || 'Dia inteiro'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

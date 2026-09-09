'use client';

import { useState } from 'react';
import { ExternalLink, MoreVertical, Pencil, Trash2, Video } from 'lucide-react';
import { AgendaEventDescription } from '@/components/agenda/AgendaEventDescription';
import { formatBrl } from '@/lib/format';

export function AgendaEventRow({ event, onEdit, onDelete, onOpenExternal }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isGoogle = event.source === 'google';
  const badgeLabel = isGoogle ? 'Compromisso' : event.statusLabel || 'Lançamento';
  const badgeColor = isGoogle ? '#168D72' : '#3F51B5';

  return (
    <article className="relative flex gap-3 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-card)]">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${event.color}22`, color: event.color }}
        aria-hidden
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</p>
            {event.timeLabel ? (
              <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">{event.timeLabel}</p>
            ) : null}
            {event.subtitle ? (
              <AgendaEventDescription text={event.subtitle} className="mt-1" />
            ) : null}
            {event.source === 'transaction' && event.amount != null ? (
              <p
                className={`mt-1 text-sm font-semibold ${
                  event.isIncome ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {event.isIncome ? '+' : '−'} {formatBrl(Math.abs(event.amount))}
              </p>
            ) : null}
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)]"
              aria-label="Ações do compromisso"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-lg">
                {isGoogle && onEdit ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--canvas)]"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(event);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                ) : null}
                {isGoogle && onDelete ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(event);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                ) : null}
                {isGoogle && event.meetLink ? (
                  <a
                    href={event.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--canvas)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Google Meet
                  </a>
                ) : null}
                {isGoogle && event.htmlLink ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--canvas)]"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenExternal?.(event.htmlLink);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Google
                  </button>
                ) : null}
                {!isGoogle ? (
                  <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    Lançamentos são editados em Transações.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badgeColor }} />
          {badgeLabel}
        </span>
      </div>
    </article>
  );
}

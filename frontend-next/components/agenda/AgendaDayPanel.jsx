'use client';

import { Loader2, Plus } from 'lucide-react';
import AgendaEmptyIllustration from '@/components/illustrations/AgendaEmptyIllustration';
import { AgendaEventDescription } from '@/components/agenda/AgendaEventDescription';
import { AgendaEventRow } from '@/components/agenda/AgendaEventRow';
import { todayYmd } from '@/lib/agendaUtils';

export function AgendaDayPanel({
  title,
  selectedYmd,
  events,
  loading,
  loadError,
  googleStatus,
  googleError,
  onRetryGoogle,
  onAdd,
  onEdit,
  onDelete,
  onOpenExternal,
  detailEvent,
}) {
  const isToday = selectedYmd === todayYmd();
  const countLabel = `${events.length} ${events.length === 1 ? 'compromisso' : 'compromissos'}`;

  return (
    <div className="flex flex-col rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--card-border)] px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          {isToday ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
              Hoje
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{countLabel}</p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {googleStatus === 'connecting' || loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            Carregando eventos…
          </div>
        ) : null}

        {loadError ? (
          <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">
            {loadError}
          </p>
        ) : null}

        {googleError ? (
          <div className="rounded-[10px] bg-amber-500/10 px-3 py-2 text-sm text-[var(--text-primary)]">
            <p>Parte dos eventos do Google não pôde ser carregada.</p>
            <button
              type="button"
              onClick={onRetryGoogle}
              className="mt-1 font-semibold text-[var(--accent)] hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {googleStatus === 'disconnected' ? (
          <p className="text-xs text-[var(--text-muted)]">
            Compromissos locais · Google não conectado
          </p>
        ) : null}

        {googleStatus === 'connected' ? (
          <p className="text-xs text-[var(--text-muted)]">Compromissos locais · Google conectado</p>
        ) : null}

        {!loading && !loadError && events.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <AgendaEmptyIllustration size={150} />
            <h3 className="mt-6 text-base font-semibold text-[var(--text-primary)]">
              Nenhum compromisso neste dia
            </h3>
            <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
              Adicione um compromisso para organizar sua agenda.
            </p>
            <button
              type="button"
              onClick={onAdd}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Adicionar neste dia
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <AgendaEventRow
                key={`${ev.source}-${ev.id}`}
                event={ev}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpenExternal={onOpenExternal}
              />
            ))}
            {events.length > 0 ? (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-[var(--card-border)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/30"
              >
                <Plus className="h-4 w-4" />
                Adicionar neste dia
              </button>
            ) : null}
          </div>
        )}

        {detailEvent ? (
          <div className="rounded-[12px] border border-[var(--accent)]/30 bg-[var(--accent-soft)]/20 p-3 text-sm text-[var(--text-primary)]">
            <p className="font-semibold">{detailEvent.title}</p>
            {detailEvent.subtitle ? (
              <AgendaEventDescription text={detailEvent.subtitle} className="mt-2" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

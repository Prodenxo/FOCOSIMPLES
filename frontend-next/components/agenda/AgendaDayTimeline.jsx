'use client';

import { eventsForDateKey } from '@/lib/agendaEvents';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AgendaDayTimeline({ selectedYmd, events, onSelectEvent }) {
  const dayEvents = eventsForDateKey(events, selectedYmd);
  const allDay = dayEvents.filter((e) => e.isAllDay);
  const timed = dayEvents.filter((e) => !e.isAllDay);

  return (
    <div className="flex flex-col gap-3">
      {allDay.length > 0 ? (
        <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)]/50 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Dia inteiro
          </p>
          <div className="space-y-1">
            {allDay.map((ev) => (
              <button
                key={`${ev.source}-${ev.id}`}
                type="button"
                onClick={() => onSelectEvent(ev, selectedYmd)}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ev.color }} />
                {ev.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div className="min-w-[280px]">
          {HOURS.map((hour) => {
            const hourEvents = timed.filter((ev) => ev.startDate.getHours() === hour);
            return (
              <div key={hour} className="grid grid-cols-[48px_1fr] border-b border-[var(--card-border)]">
                <div className="py-2 pr-2 text-right text-[10px] text-[var(--text-muted)]">
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="min-h-[44px] space-y-1 border-l border-[var(--card-border)] p-1">
                  {hourEvents.map((ev) => (
                    <button
                      key={`${ev.source}-${ev.id}`}
                      type="button"
                      onClick={() => onSelectEvent(ev, selectedYmd)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-white"
                      style={{ backgroundColor: ev.color }}
                    >
                      {ev.timeLabel ? `${ev.timeLabel} · ` : ''}
                      {ev.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

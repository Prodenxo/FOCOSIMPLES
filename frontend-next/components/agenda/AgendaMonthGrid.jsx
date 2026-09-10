'use client';

import { useMemo } from 'react';
import { DAY_NAMES, buildMonthGridWeeks, resolveGridDateStr, todayYmd } from '@/lib/agendaUtils';
import { cellPreviewLabel, eventsForDateKey } from '@/lib/agendaEvents';

const MAX_VISIBLE = 2;

export function AgendaMonthGrid({
  currentMonthYmd,
  selectedYmd,
  events,
  onSelectDate,
  onSelectEvent,
}) {
  const weeks = useMemo(() => buildMonthGridWeeks(currentMonthYmd), [currentMonthYmd]);
  const today = todayYmd();
  const monthPrefix = currentMonthYmd.slice(0, 7);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--card-border)]">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="flex flex-col" role="grid" aria-label="Calendário mensal">
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7 border-b border-[var(--card-border)] last:border-b-0">
            {week.map((day, di) => {
              const dateStr = resolveGridDateStr(currentMonthYmd, day, wi, di);
              if (!dateStr) return <div key={di} className="min-h-[88px] bg-[var(--canvas)]/30" />;

              const inMonth = dateStr.startsWith(monthPrefix);
              const isSelected = dateStr === selectedYmd;
              const isToday = dateStr === today;
              const isWeekend = di >= 5;
              const dayEvents = eventsForDateKey(events, dateStr);
              const visible = dayEvents.slice(0, MAX_VISIBLE);
              const extra = dayEvents.length - visible.length;

              return (
                <div
                  key={di}
                  role="gridcell"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onSelectDate(dateStr, !inMonth)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDate(dateStr, !inMonth);
                    }
                  }}
                  className={`min-h-[88px] cursor-pointer border-r border-[var(--card-border)] p-1.5 text-left last:border-r-0 ${
                    isWeekend ? 'bg-[var(--canvas)]/40' : 'bg-[var(--card-bg)]'
                  } ${isSelected ? 'ring-2 ring-inset ring-[var(--accent)]' : ''} ${
                    !inMonth ? 'opacity-55' : ''
                  } hover:bg-[var(--accent-soft)]/20`}
                  aria-label={`Dia ${dateStr}`}
                  aria-current={isSelected ? 'date' : undefined}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white'
                        : isToday
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {parseInt(dateStr.slice(8, 10), 10)}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {visible.map((ev) => (
                      <button
                        key={`${ev.source}-${ev.id}-${dateStr}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(ev, dateStr);
                        }}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--canvas)]"
                        title={ev.title}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ev.color }}
                          aria-hidden
                        />
                        <span className="truncate">{cellPreviewLabel(ev)}</span>
                      </button>
                    ))}
                    {extra > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(dateStr, !inMonth);
                        }}
                        className="block w-full px-1 text-left text-[10px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        +{extra} mais
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 px-1 text-xs text-[var(--text-muted)]">
        Clique em uma data para ver os detalhes.
      </p>
      <div className="mt-2 flex flex-wrap gap-4 px-1 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#168D72]" aria-hidden />
          Compromissos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#3F51B5]" aria-hidden />
          Lançamentos
        </span>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { DAY_NAMES, getWeekDays, localDateStr, todayYmd } from '@/lib/agendaUtils';
import { eventsForDateKey } from '@/lib/agendaEvents';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AgendaWeekView({ selectedYmd, events, onSelectDate, onSelectEvent }) {
  const days = useMemo(() => getWeekDays(selectedYmd), [selectedYmd]);
  const today = todayYmd();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-[var(--card-border)]">
          <div />
          {days.map((d, i) => {
            const key = localDateStr(d);
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key, false)}
                className={`border-l border-[var(--card-border)] px-2 py-2 text-center ${
                  isToday ? 'bg-[var(--accent-soft)]/30' : ''
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {DAY_NAMES[i]}
                </div>
                <div className={`text-sm font-semibold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  {d.getDate()}
                </div>
              </button>
            );
          })}
        </div>
        <div className="relative grid grid-cols-[48px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-[var(--card-border)] pr-2 pt-1 text-right text-[10px] text-[var(--text-muted)]">
                {String(hour).padStart(2, '0')}:00
              </div>
              {days.map((d) => {
                const key = localDateStr(d);
                const hourEvents = eventsForDateKey(events, key).filter((ev) => {
                  if (ev.isAllDay) return hour === 0;
                  return ev.startDate.getHours() === hour;
                });
                return (
                  <div
                    key={`${key}-${hour}`}
                    className="min-h-[40px] border-b border-l border-[var(--card-border)] p-0.5"
                  >
                    {hourEvents.map((ev) => (
                      <button
                        key={`${ev.source}-${ev.id}`}
                        type="button"
                        onClick={() => onSelectEvent(ev, key)}
                        className="mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                        style={{ backgroundColor: ev.color }}
                        title={ev.title}
                      >
                        {ev.isAllDay ? ev.title : `${ev.timeLabel?.split('–')[0]?.trim() || ''} ${ev.title}`}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

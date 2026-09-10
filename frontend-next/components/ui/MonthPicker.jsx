'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel } from '@/lib/format';

export function MonthPicker({ year, month, onPrev, onNext }) {
  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Mês anterior"
        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="flex items-center gap-2 px-2 text-sm font-medium text-[var(--text-primary)]">
        <CalendarDays className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        {monthLabel(year, month)}
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Próximo mês"
        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const VIEW_OPTIONS = [
  { key: 'month', label: 'Mês' },
  { key: 'week', label: 'Semana' },
  { key: 'day', label: 'Dia' },
];

export function AgendaToolbar({
  periodLabel,
  viewMode,
  onViewModeChange,
  onPrevious,
  onNext,
  onToday,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          onClick={onPrevious}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--canvas)]"
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[10rem] text-center text-sm font-semibold text-[var(--text-primary)] sm:min-w-[12rem]">
          {periodLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--canvas)]"
          aria-label="Próximo período"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="ml-1 inline-flex h-9 items-center justify-center rounded-lg border border-[var(--card-border)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
        >
          Hoje
        </button>
      </div>
      <div
        className="inline-flex w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-1 sm:w-auto"
        role="tablist"
        aria-label="Visualização da agenda"
      >
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={viewMode === opt.key}
            onClick={() => onViewModeChange(opt.key)}
            className={`flex-1 rounded-[10px] px-4 py-2 text-xs font-semibold sm:flex-none ${
              viewMode === opt.key
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

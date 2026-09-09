'use client';

import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { MonthPicker } from '@/components/ui/MonthPicker';

export function CategoryFiltersBar({
  viewTipo,
  onViewTipoChange,
  searchTerm,
  onSearchChange,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  searchResultCount,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full max-w-xs rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={() => onViewTipoChange('saida')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
              viewTipo === 'saida'
                ? 'bg-[var(--expense-soft)] text-red-500'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            Saídas
          </button>
          <button
            type="button"
            onClick={() => onViewTipoChange('entrada')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
              viewTipo === 'entrada'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
            Entradas
          </button>
        </div>

        <MonthPicker year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar categoria..."
          className="h-11 w-full rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] pl-10 pr-3 text-sm text-[var(--text-primary)] shadow-[var(--shadow-card)] outline-none placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        />
      </div>

      {searchTerm.trim() ? (
        <p className="text-xs text-[var(--text-muted)]">
          {searchResultCount === 0
            ? 'Nenhum resultado para a busca.'
            : `${searchResultCount} ${searchResultCount === 1 ? 'resultado' : 'resultados'} encontrados.`}
        </p>
      ) : null}
    </div>
  );
}

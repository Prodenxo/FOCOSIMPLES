'use client';

import { AppSelect } from '@/components/ui/AppSelect';

import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { getStatusFilterOptions, SORT_OPTIONS } from '@/lib/budgetUtils';
import { MonthPicker } from '@/components/ui/MonthPicker';

export function BudgetFiltersBar({
  viewTipo,
  onViewTipoChange,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  resultCount,
  budgetCountLabel,
  showListFilters = true,
}) {
  const statusOptions = getStatusFilterOptions(viewTipo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MonthPicker year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />
        <div className="inline-flex w-full max-w-xs rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-[var(--shadow-card)] lg:ml-auto">
          <button
            type="button"
            onClick={() => onViewTipoChange('saida')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold ${
              viewTipo === 'saida'
                ? 'bg-[var(--expense-soft)] text-red-500'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            Saídas
          </button>
          <button
            type="button"
            onClick={() => onViewTipoChange('entrada')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold ${
              viewTipo === 'entrada'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
            Entradas
          </button>
        </div>
      </div>

      {budgetCountLabel ? (
        <p className="text-sm text-[var(--text-muted)]">{budgetCountLabel}</p>
      ) : null}

      {!showListFilters ? null : (
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
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
        <AppSelect
          ariaLabel="Filtrar por status"
          value={statusFilter}
          onChange={onStatusFilterChange}
          searchable={false}
          className="w-[160px]"
          options={statusOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
        />
        <AppSelect
          ariaLabel="Ordenar lista"
          value={sortBy}
          onChange={onSortChange}
          searchable={false}
          className="w-[160px]"
          options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        />
      </div>
      )}

      {showListFilters && resultCount != null ? (
        <p className="text-xs text-[var(--text-muted)]">
          {resultCount === 0
            ? 'Nenhum resultado para os filtros aplicados.'
            : `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}`}
        </p>
      ) : null}
    </div>
  );
}

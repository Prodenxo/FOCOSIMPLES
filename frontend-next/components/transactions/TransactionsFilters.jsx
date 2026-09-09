'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { MONTH_NAMES } from '@/lib/format';

const PERIOD_PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
];

export function TransactionsFilters({
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  period,
  onPeriodChange,
  useCustomRange,
  onCustomRangeToggle,
  dateRange,
  onDateRangeChange,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClear,
}) {
  const monthLabel = `${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}`;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-11 items-center gap-1 rounded-[14px] border border-[var(--card-border)] bg-[var(--canvas)] px-1">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--card-bg)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="flex items-center gap-2 px-2 text-sm font-medium text-[var(--text-primary)]">
            <CalendarDays className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Próximo mês"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--card-bg)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPeriodChange(preset.id)}
            className={`inline-flex h-11 items-center rounded-[14px] px-4 text-sm font-semibold transition-colors ${
              !useCustomRange && period === preset.id
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={onCustomRangeToggle}
          className={`inline-flex h-11 items-center rounded-[14px] px-4 text-sm font-semibold transition-colors ${
            useCustomRange
              ? 'bg-[var(--accent)] text-white'
              : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Período personalizado
        </button>
      </div>

      {useCustomRange ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Data inicial
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="h-11 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Data final
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start || undefined}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="h-11 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--text-primary)]"
            />
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar receitas ou gastos"
            className="h-11 w-full rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </label>

        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          aria-label="Tipo"
          className="h-11 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Status"
          className="h-11 min-w-[150px] rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Todos os status</option>
          <option value="pago">Realizados</option>
          <option value="pendente">Pendentes</option>
        </select>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11 items-center rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Limpar
        </button>
      </div>
    </Card>
  );
}

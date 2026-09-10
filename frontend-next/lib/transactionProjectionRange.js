/** Intervalo de meses para projectRecurrences conforme filtros da tela de transações. */
export function computeProjectionMonthRange(periodOptions) {
  const { period, selectedMonth, dateRange, useCustomRange } = periodOptions;

  if (useCustomRange && dateRange.start && dateRange.end) {
    const start = new Date(`${dateRange.start}T12:00:00`);
    const end = new Date(`${dateRange.end}T12:00:00`);
    return {
      startYear: start.getFullYear(),
      startMonth: start.getMonth() + 1,
      endYear: end.getFullYear(),
      endMonth: end.getMonth() + 1,
    };
  }

  if (period === 'month') {
    return {
      startYear: selectedMonth.year,
      startMonth: selectedMonth.month,
      endYear: selectedMonth.year,
      endMonth: selectedMonth.month,
    };
  }

  const now = new Date();
  return {
    startYear: now.getFullYear(),
    startMonth: now.getMonth() + 1,
    endYear: now.getFullYear(),
    endMonth: now.getMonth() + 1,
  };
}

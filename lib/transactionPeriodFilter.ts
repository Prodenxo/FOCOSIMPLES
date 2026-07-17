export type TransactionPeriodPreset = 'Esse mês' | 'Essa semana' | 'Hoje'

export type TransactionDateRange = { start: string; end: string }

type TxDateSource = { data?: string | null; criado_em?: string | null }

export function parseTransactionDate(t: TxDateSource): Date {
  const raw = t.data ? String(t.data).slice(0, 10) : ''
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00`)
  }
  if (t.criado_em) return new Date(t.criado_em)
  return new Date()
}

export function isInCurrentWeek(date: Date): boolean {
  const now = new Date()
  const day = now.getDay()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
  firstDay.setHours(0, 0, 0, 0)
  const lastDay = new Date(firstDay)
  lastDay.setDate(firstDay.getDate() + 6)
  lastDay.setHours(23, 59, 59, 999)
  return date >= firstDay && date <= lastDay
}

export function isTodayDate(date: Date): boolean {
  const now = new Date()
  return (
    date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear()
  )
}

export function isInSelectedMonth(
  t: TxDateSource,
  selectedMonth: { year: number; month: number },
): boolean {
  const data = parseTransactionDate(t)
  return (
    data.getMonth() === selectedMonth.month - 1
    && data.getFullYear() === selectedMonth.year
  )
}

export function matchesTransactionPeriod(
  t: TxDateSource,
  options: {
    period: TransactionPeriodPreset
    selectedMonth: { year: number; month: number }
    dateRange: TransactionDateRange
    useCustomRange: boolean
  },
): boolean {
  const data = parseTransactionDate(t)
  const { period, selectedMonth, dateRange, useCustomRange } = options

  if (useCustomRange && dateRange.start && dateRange.end) {
    const start = new Date(`${dateRange.start}T00:00:00`)
    const end = new Date(`${dateRange.end}T23:59:59`)
    return data >= start && data <= end
  }

  if (period === 'Essa semana') return isInCurrentWeek(data)
  if (period === 'Hoje') return isTodayDate(data)

  return isInSelectedMonth(t, selectedMonth)
}

export function periodToolbarLabel(
  period: TransactionPeriodPreset,
  selectedMonth: { year: number; month: number },
  monthNames: string[],
  useCustomRange: boolean,
  dateRange: TransactionDateRange,
): string {
  if (useCustomRange && dateRange.start && dateRange.end) {
    return `${dateRange.start} → ${dateRange.end}`
  }
  if (period === 'Hoje') return 'Hoje'
  if (period === 'Essa semana') return 'Esta semana'
  return `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`
}

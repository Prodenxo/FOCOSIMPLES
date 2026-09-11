export function parseTransactionDate(t) {
  const raw = t.data ? String(t.data).slice(0, 10) : '';
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00`);
  }
  if (t.criado_em) return new Date(t.criado_em);
  return new Date();
}

export function isInCurrentWeek(date) {
  const now = new Date();
  const day = now.getDay();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);
  lastDay.setHours(23, 59, 59, 999);
  return date >= firstDay && date <= lastDay;
}

export function isTodayDate(date) {
  const now = new Date();
  return (
    date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear()
  );
}

export function isInSelectedMonth(t, selectedMonth) {
  const data = parseTransactionDate(t);
  return (
    data.getMonth() === selectedMonth.month - 1
    && data.getFullYear() === selectedMonth.year
  );
}

export function matchesTransactionPeriod(t, options) {
  const data = parseTransactionDate(t);
  const { period, selectedMonth, dateRange, useCustomRange } = options;

  if (useCustomRange && dateRange.start && dateRange.end) {
    const start = new Date(`${dateRange.start}T00:00:00`);
    const end = new Date(`${dateRange.end}T23:59:59`);
    return data >= start && data <= end;
  }

  if (period === 'week') return isInCurrentWeek(data);
  if (period === 'today') return isTodayDate(data);

  return isInSelectedMonth(t, selectedMonth);
}

export function periodToolbarLabel(period, selectedMonth, monthNames, useCustomRange, dateRange) {
  if (useCustomRange && dateRange.start && dateRange.end) {
    return `${formatYmdToBr(dateRange.start)} – ${formatYmdToBr(dateRange.end)}`;
  }
  if (period === 'today') return 'Hoje';
  if (period === 'week') return 'Esta semana';
  return `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`;
}

export function formatYmdToBr(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd || '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const WEEKDAY_LONG = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export function formatSectionDateLabel(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd || '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  const today = new Date();
  const isToday =
    dt.getDate() === today.getDate()
    && dt.getMonth() === today.getMonth()
    && dt.getFullYear() === today.getFullYear();
  const weekday = WEEKDAY_LONG[dt.getDay()];
  const monthShort = dt.toLocaleDateString('pt-BR', { month: 'long' });
  const dayPadded = String(d).padStart(2, '0');
  if (isToday) return `Hoje, ${weekday}, ${dayPadded} de ${monthShort}`;
  return `${weekday}, ${dayPadded} de ${monthShort}`;
}

export function ymdFromDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseTransactionDate(t) {
  const raw = t.data ? String(t.data).slice(0, 10) : '';
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00`);
  }
  if (t.criado_em) return new Date(t.criado_em);
  return new Date();
}

export function isInSelectedMonth(t, selectedMonth) {
  const data = parseTransactionDate(t);
  return (
    data.getMonth() === selectedMonth.month - 1
    && data.getFullYear() === selectedMonth.year
  );
}

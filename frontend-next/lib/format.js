export function formatBrl(value) {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(value) {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return `${Math.round(n)}%`;
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

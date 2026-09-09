export const pad2 = (value) => String(value).padStart(2, '0');

export const getMonthStart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${pad2(month)}-01`;
};

export const normalizeCategoryKey = (nome) => String(nome || '').trim().toLowerCase();

export function normalizarTipo(tipo) {
  const tipoLower = String(tipo || '').toLowerCase().trim();
  if (tipoLower === 'entrada') return 'entrada';
  return 'saida';
}

export function normalizarValor(valor) {
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor;
  const parsed = parseFloat(String(valor || '0'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parsearData(dataStr, criadoEmStr) {
  if (dataStr) {
    if (dataStr.includes('T')) return new Date(dataStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return new Date(`${dataStr}T00:00:00`);
    const parsed = new Date(dataStr);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(criadoEmStr ?? '');
}

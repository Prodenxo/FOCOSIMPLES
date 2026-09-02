/**
 * Utilitários compartilhados do Dashboard (normalização, datas, formatação).
 */
export const pad2 = (value: number) => String(value).padStart(2, '0');

export const getMonthStart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${pad2(month)}-01`;
};

export const normalizeCategoryKey = (nome: string) => String(nome || '').trim().toLowerCase();

export function normalizarTipo(tipo: string): 'entrada' | 'saida' {
  const tipoLower = String(tipo || '').toLowerCase().trim();
  if (tipoLower === 'entrada') return 'entrada';
  return 'saida';
}

export function normalizarValor(valor: unknown): number {
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor;
  const parsed = parseFloat(String(valor || '0'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parsearData(
  dataStr: string | null | undefined,
  criadoEmStr: string
): Date {
  if (dataStr) {
    if (dataStr.includes('T')) return new Date(dataStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return new Date(dataStr + 'T00:00:00');
    const parsed = new Date(dataStr);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(criadoEmStr ?? '');
}

export function formatarDataParaExibicao(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR');
}

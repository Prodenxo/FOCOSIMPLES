import type { DreMatrixCell } from './categoryService';

export type BpoCategory = {
  id: number;
  nome: string;
  tipo: string;
};

export type BpoColumnKey = 'orcado' | 'realizado' | 'variacao';

export type BpoPendingTxn = {
  classificacao: string;
  categoria?: number | string | null;
  tipo: string;
  status: string;
  valor: number;
  data?: string;
  criado_em?: string;
};

export type BpoMonthMetrics = {
  orcado: number | null;
  previsto: number;
  realizado: number;
  variacao: number | null;
};

export type BpoMatrixRow = {
  categoriasId: number;
  nome: string;
  tipo: 'entrada' | 'saida';
  byMonth: BpoMonthMetrics[];
  annual: BpoMonthMetrics;
};

export type BpoMatrixViewModel = {
  receitas: BpoMatrixRow[];
  despesas: BpoMatrixRow[];
  resultado: BpoMonthMetrics[];
};

function isEntradaTipo(tipo: string): boolean {
  return tipo === 'entrada';
}

function isSaidaTipo(tipo: string): boolean {
  return tipo === 'saida' || tipo === 'saída';
}

function getRealizadoCell(cell: DreMatrixCell | undefined, tipo: string): number {
  if (!cell) return 0;
  return isEntradaTipo(tipo) ? Number(cell.valor_recebido || 0) : Number(cell.valor_gasto || 0);
}

export function formatBpoCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function normalizeBpoCategoryName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getBpoTxnDate(t: BpoPendingTxn): Date {
  return t.data ? new Date(`${t.data}T00:00:00-03:00`) : new Date(t.criado_em || Date.now());
}

export function isBpoSaidaTipo(tipo: string): boolean {
  return tipo === 'saída' || tipo === 'saida';
}

export function computeBpoVariacao(orcado: number | null, realizado: number): number | null {
  if (orcado === null) return null;
  return realizado - orcado;
}

export function aggregateBpoMonths(months: BpoMonthMetrics[]): BpoMonthMetrics {
  let orcadoSum = 0;
  let hasOrcado = false;
  let previsto = 0;
  let realizado = 0;

  for (const m of months) {
    if (m.orcado !== null) {
      hasOrcado = true;
      orcadoSum += m.orcado;
    }
    previsto += m.previsto;
    realizado += m.realizado;
  }

  return {
    orcado: hasOrcado ? orcadoSum : null,
    previsto,
    realizado,
    variacao: hasOrcado ? computeBpoVariacao(orcadoSum, realizado) : null,
  };
}

function resolveCategoryIdFromTxn(
  t: BpoPendingTxn,
  categoryNameToId: Map<string, number>
): number | null {
  if (t.categoria !== null && t.categoria !== undefined && t.categoria !== '') {
    return Number(t.categoria);
  }
  const normalized = normalizeBpoCategoryName(t.classificacao || '');
  return categoryNameToId.get(normalized) ?? null;
}

function buildPrevistoMap(
  pendingTxns: BpoPendingTxn[],
  year: number,
  categoryNameToId: Map<string, number>
): Map<string, number> {
  const map = new Map<string, number>();

  for (const t of pendingTxns) {
    const date = getBpoTxnDate(t);
    if (date.getFullYear() !== year) continue;

    const isPendingEntrada = t.tipo === 'entrada' && t.status === 'a_receber';
    const isPendingSaida = isBpoSaidaTipo(t.tipo) && t.status === 'a_pagar';
    if (!isPendingEntrada && !isPendingSaida) continue;

    const catId = resolveCategoryIdFromTxn(t, categoryNameToId);
    if (!catId || Number.isNaN(catId)) continue;

    const month = date.getMonth() + 1;
    const key = `${catId}_${month}`;
    map.set(key, (map.get(key) || 0) + Number(t.valor || 0));
  }

  return map;
}

function isRowEligible(metrics: BpoMonthMetrics[]): boolean {
  return metrics.some(
    (m) => m.realizado !== 0 || (m.orcado !== null && m.orcado > 0)
  );
}

function buildRowForCategory(
  cat: BpoCategory,
  cells: DreMatrixCell[],
  previstoMap: Map<string, number>
): BpoMatrixRow {
  const byMonth: BpoMonthMetrics[] = [];
  const cellByMonth = new Map<number, DreMatrixCell>();
  for (const cell of cells) {
    if (cell.categorias_id === cat.id) cellByMonth.set(cell.month, cell);
  }

  for (let month = 1; month <= 12; month += 1) {
    const cell = cellByMonth.get(month);
    const orcadoRaw = cell?.valor_orcado;
    const orcado = orcadoRaw === null || orcadoRaw === undefined ? null : Number(orcadoRaw);
    const realizado = getRealizadoCell(cell, cat.tipo);
    const previsto = previstoMap.get(`${cat.id}_${month}`) || 0;

    byMonth.push({
      orcado,
      previsto,
      realizado,
      variacao: computeBpoVariacao(orcado, realizado),
    });
  }

  const tipo: 'entrada' | 'saida' = isEntradaTipo(cat.tipo) ? 'entrada' : 'saida';

  return {
    categoriasId: cat.id,
    nome: cat.nome,
    tipo,
    byMonth,
    annual: aggregateBpoMonths(byMonth),
  };
}

function sumSectionByMonth(rows: BpoMatrixRow[]): BpoMonthMetrics[] {
  const totals: BpoMonthMetrics[] = Array.from({ length: 12 }, () => ({
    orcado: null,
    previsto: 0,
    realizado: 0,
    variacao: null,
  }));

  for (const row of rows) {
    row.byMonth.forEach((m, idx) => {
      const t = totals[idx];
      if (m.orcado !== null) {
        t.orcado = (t.orcado ?? 0) + m.orcado;
      }
      t.previsto += m.previsto;
      t.realizado += m.realizado;
    });
  }

  return totals.map((t) => ({
    ...t,
    variacao: t.orcado !== null ? computeBpoVariacao(t.orcado, t.realizado) : null,
  }));
}

function subtractMetrics(a: BpoMonthMetrics[], b: BpoMonthMetrics[]): BpoMonthMetrics[] {
  return a.map((left, idx) => {
    const right = b[idx];
    const orcado =
      left.orcado !== null || right.orcado !== null
        ? (left.orcado ?? 0) - (right.orcado ?? 0)
        : null;
    const previsto = left.previsto - right.previsto;
    const realizado = left.realizado - right.realizado;
    return {
      orcado,
      previsto,
      realizado,
      variacao: orcado !== null ? computeBpoVariacao(orcado, realizado) : null,
    };
  });
}

export function buildBpoMatrixViewModel(
  categories: BpoCategory[],
  cells: DreMatrixCell[],
  pendingTxns: BpoPendingTxn[],
  year: number
): BpoMatrixViewModel {
  const categoryNameToId = new Map<string, number>();
  for (const cat of categories) {
    categoryNameToId.set(normalizeBpoCategoryName(cat.nome), cat.id);
  }

  const previstoMap = buildPrevistoMap(pendingTxns, year, categoryNameToId);

  const rows = categories
    .filter((c) => isEntradaTipo(c.tipo) || isSaidaTipo(c.tipo))
    .map((c) => buildRowForCategory(c, cells, previstoMap))
    .filter((r) => isRowEligible(r.byMonth))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const receitas = rows.filter((r) => r.tipo === 'entrada');
  const despesas = rows.filter((r) => r.tipo === 'saida');
  const receitaTotals = sumSectionByMonth(receitas);
  const despesaTotals = sumSectionByMonth(despesas);
  const resultado = subtractMetrics(receitaTotals, despesaTotals);

  return { receitas, despesas, resultado };
}

export function filterBpoRowsBySearch(rows: BpoMatrixRow[], query: string): BpoMatrixRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.nome.toLowerCase().includes(q));
}

export function formatBpoMetricValue(column: BpoColumnKey, metrics: BpoMonthMetrics): string {
  if (column === 'orcado') {
    return metrics.orcado === null ? '—' : formatBpoCurrency(metrics.orcado);
  }
  if (column === 'realizado') {
    return formatBpoCurrency(metrics.realizado);
  }
  return metrics.variacao === null ? '—' : formatBpoCurrency(metrics.variacao);
}

export function bpoMonthHeaderLabel(monthIndex: number, year: number): string {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yy = String(year).slice(-2);
  return `${labels[monthIndex]}/${yy}`;
}

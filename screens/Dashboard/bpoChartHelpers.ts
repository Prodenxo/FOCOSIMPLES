export type BpoQuarterSlide = {
  key: string;
  label: string;
  labels: string[];
  months: number[];
};

export type BpoCategorySeries = {
  budgeted: number[];
  realized: number[];
};

export function buildBudgetAwareMonthTotals(
  category: BpoCategorySeries,
  months: number[]
): number[][] {
  return months.map((monthIndex) => {
    const budgeted = category.budgeted[monthIndex] || 0;
    const realized = category.realized[monthIndex] || 0;
    const withinBudget = Math.min(realized, budgeted);
    const overBudget = Math.max(0, realized - budgeted);
    return [withinBudget, overBudget];
  });
}

export function sanitizeBpoMonthTotals(rows: number[][]): number[][] {
  return rows.map(([withinBudget, overBudget]) => [
    Number.isFinite(withinBudget) ? Math.max(0, withinBudget) : 0,
    Number.isFinite(overBudget) ? Math.max(0, overBudget) : 0,
  ]);
}

export function getBpoMaxStack(monthTotals: number[][]): number {
  if (monthTotals.length === 0) return 0;
  return Math.max(
    0,
    ...monthTotals.map(([withinBudget, overBudget]) => (withinBudget || 0) + (overBudget || 0))
  );
}

/** Primeiro trimestre com lançamento no ano (evita abrir T1 vazio). */
export function findFirstBpoQuarterWithData(
  category: BpoCategorySeries,
  quarters: BpoQuarterSlide[]
): number {
  const withData = quarters.findIndex((quarter) => {
    const totals = sanitizeBpoMonthTotals(buildBudgetAwareMonthTotals(category, quarter.months));
    return getBpoMaxStack(totals) > 0;
  });
  return withData >= 0 ? withData : 0;
}

export function getBpoYearMaxStack(
  category: BpoCategorySeries,
  quarters: BpoQuarterSlide[]
): number {
  const allMonths = quarters.flatMap((q) => q.months);
  const totals = sanitizeBpoMonthTotals(buildBudgetAwareMonthTotals(category, allMonths));
  return getBpoMaxStack(totals);
}

export function buildBpoYAxis(maxValue: number, ticks: number): number[] {
  if (maxValue <= 0) return [];
  const step = maxValue / (ticks - 1);
  return Array.from({ length: ticks }, (_, index) => step * (ticks - 1 - index));
}

export type BpoMonthInsight = {
  budgeted: number;
  realized: number;
  variacao: number;
  excesso: number;
  atingimentoPct: number | null;
  status: 'empty' | 'within' | 'over' | 'under';
};

export function buildBpoMonthInsight(budgeted: number, realized: number): BpoMonthInsight {
  const safeBudget = Math.max(0, budgeted || 0);
  const safeRealized = Math.max(0, realized || 0);
  const variacao = safeRealized - safeBudget;
  const excesso = Math.max(0, variacao);
  const atingimentoPct = safeBudget > 0 ? (safeRealized / safeBudget) * 100 : null;

  let status: BpoMonthInsight['status'] = 'empty';
  if (safeRealized > 0 || safeBudget > 0) {
    if (safeBudget <= 0 && safeRealized > 0) status = 'over';
    else if (variacao > 0) status = 'over';
    else if (safeRealized < safeBudget) status = 'under';
    else status = 'within';
  }

  return {
    budgeted: safeBudget,
    realized: safeRealized,
    variacao,
    excesso,
    atingimentoPct,
    status,
  };
}

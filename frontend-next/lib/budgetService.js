import { apiClient } from './apiClient';

export function normalizeBudgetSummaryRow(row) {
  const rawOrcado = row.valor_orcado ?? row['valor_orçado'];
  return {
    categorias_id: Number(row.categorias_id) || 0,
    valor_orcado: rawOrcado != null && rawOrcado !== '' ? Number(rawOrcado) : null,
    valor_gasto: Number(row.valor_gasto) || 0,
    valor_recebido: Number(row.valor_recebido) || 0,
  };
}

export async function fetchCategoryBudgetsSummary(year, month) {
  const data = await apiClient.get(
    `/categories/budgets/summary?year=${year}&month=${month}`,
  );
  return (data || []).map(normalizeBudgetSummaryRow);
}

export async function saveCategoryBudget({ categorias_id, valor_orcado, date }) {
  const data = await apiClient.post('/categories/budgets', {
    categorias_id,
    valor_orcado,
    date,
  });
  return data;
}

export async function deleteCategoryBudget(categorias_id, date) {
  return saveCategoryBudget({ categorias_id, valor_orcado: null, date });
}

export async function duplicateMonthlyBudgets(year, month) {
  const data = await apiClient.post('/categories/budgets/duplicate', { year, month });
  return data;
}

export function getMonthStartDate(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

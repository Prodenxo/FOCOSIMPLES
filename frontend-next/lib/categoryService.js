import { apiClient } from './apiClient';
import { normalizeContaRow } from './contaFinanceiraTypes';

export async function fetchUserCategories() {
  const data = await apiClient.get('/categories');
  return (data || []).map(normalizeCategoryRow);
}

export function normalizeCategoryRow(row) {
  return {
    id: Number(row.id) || 0,
    nome: String(row.nome || ''),
    tipo: String(row.tipo || ''),
    user_id: row.user_id != null ? String(row.user_id) : null,
  };
}

export async function createCategory(payload) {
  const data = await apiClient.post('/categories', payload);
  return normalizeCategoryRow(data);
}

export async function updateCategory(payload) {
  const data = await apiClient.put('/categories', payload);
  return normalizeCategoryRow(data);
}

export async function deleteCategory(id, reassignTo) {
  const qs = new URLSearchParams({
    id: String(id),
    reassign_to: reassignTo,
  });
  return apiClient.delete(`/categories?${qs.toString()}`);
}

export async function fetchCategoryBudgetsSummary(year, month) {
  try {
    const data = await apiClient.get(
      `/categories/budgets/summary?year=${year}&month=${month}`,
    );
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchContasFinanceiras() {
  const data = await apiClient.get('/contas-financeiras');
  return (data || []).map(normalizeContaRow);
}

export function normalizeTransactionRow(t) {
  return {
    ...t,
    id: String(t.id || ''),
    valor: typeof t.valor === 'string' ? parseFloat(t.valor) : Number(t.valor),
    tipo: String(t.tipo) === 'saida' ? 'saída' : String(t.tipo),
    classificacao: String(t.classificacao || ''),
    status: String(t.status || ''),
    user_id: t.user_id ? String(t.user_id) : null,
    criado_em: String(t.criado_em || ''),
    data: t.data ? String(t.data) : null,
    categoria: t.categoria ?? null,
    conta_id: t.conta_id ? String(t.conta_id) : null,
  };
}

export async function fetchTransactions() {
  const data = await apiClient.get('/transactions');
  return (data || []).map(normalizeTransactionRow);
}

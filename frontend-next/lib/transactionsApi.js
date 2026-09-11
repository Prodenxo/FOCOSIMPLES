import { apiClient } from './apiClient';
import { normalizeTransactionRow } from './categoryService';

/** Evita duplicação visual se a API retornar o mesmo ID mais de uma vez. */
function dedupeTransactionsById(list) {
  const byId = new Map();
  for (const row of list) {
    const normalized = normalizeTransactionRow(row);
    if (!normalized.id) continue;
    byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values());
}

export async function fetchAllTransactions() {
  const data = await apiClient.get('/transactions');
  return dedupeTransactionsById(data || []);
}

export async function createTransaction(payload) {
  const data = await apiClient.post('/transactions', payload);
  return normalizeTransactionRow(data);
}

export async function updateTransaction(id, payload) {
  const data = await apiClient.put('/transactions', { id, ...payload });
  return normalizeTransactionRow(data);
}

export async function deleteTransaction(id) {
  return apiClient.delete(`/transactions?id=${encodeURIComponent(id)}`);
}

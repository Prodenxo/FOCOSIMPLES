import { apiClient } from './apiClient';
import { normalizeContaRow } from './contaFinanceiraTypes';

export async function fetchContasFinanceiras(includeInactive = false) {
  const qs = includeInactive ? '?all=1' : '';
  const data = await apiClient.get(`/contas-financeiras${qs}`);
  return (data || []).map(normalizeContaRow);
}

export async function createContaFinanceira(payload) {
  const data = await apiClient.post('/contas-financeiras', payload);
  return normalizeContaRow(data);
}

export async function updateContaFinanceira(id, payload) {
  const data = await apiClient.put(`/contas-financeiras/${encodeURIComponent(id)}`, payload);
  return normalizeContaRow(data);
}

export async function deleteContaFinanceira(id) {
  const data = await apiClient.delete(`/contas-financeiras/${encodeURIComponent(id)}`);
  return data ? normalizeContaRow(data) : null;
}

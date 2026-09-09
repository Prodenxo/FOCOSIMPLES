import { apiClient } from './apiClient';
import { normalizeContaMoedaGlobalRow } from './contaMoedaGlobalTypes';

export async function fetchContasMoedaGlobal() {
  const data = await apiClient.get('/contas-moeda-global');
  return (data || []).map(normalizeContaMoedaGlobalRow);
}

export async function createContaMoedaGlobal(payload) {
  const data = await apiClient.post('/contas-moeda-global', payload);
  return normalizeContaMoedaGlobalRow(data);
}

export async function updateContaMoedaGlobal(id, payload) {
  const data = await apiClient.put(`/contas-moeda-global/${encodeURIComponent(id)}`, payload);
  return normalizeContaMoedaGlobalRow(data);
}

export async function deleteContaMoedaGlobal(id) {
  const data = await apiClient.delete(`/contas-moeda-global/${encodeURIComponent(id)}`);
  return data ? normalizeContaMoedaGlobalRow(data) : null;
}

/** Total convertido — só moedas com cotação disponível entram na soma. */
export function computeContaGlobalTotal(contas, rates) {
  let total = 0;
  let convertible = 0;
  let missing = 0;

  for (const conta of contas) {
    const code = conta.moeda;
    const rate = code === 'BRL' ? 1 : rates[code];
    if (rate == null || !Number.isFinite(rate)) {
      missing += 1;
      continue;
    }
    total += conta.valor * rate;
    convertible += 1;
  }

  return {
    total,
    convertible,
    missing,
    allRatesAvailable: missing === 0,
  };
}

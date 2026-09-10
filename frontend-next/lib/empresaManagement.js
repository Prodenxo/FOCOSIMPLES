import { apiClient } from '@/lib/apiClient';

export async function listEmpresasAdmin() {
  const result = await apiClient.get('/users/empresas');
  return result?.empresas || [];
}

export async function getEmpresaById(empresaId) {
  const result = await apiClient.get(`/users/empresas/${encodeURIComponent(empresaId)}`);
  return result?.empresa || null;
}

export async function createEmpresa(input) {
  const result = await apiClient.post('/users/empresas', input);
  if (!result?.empresa) throw new Error('Resposta inválida ao criar empresa');
  return result.empresa;
}

export async function updateEmpresa(empresaId, input) {
  const result = await apiClient.put(`/users/empresas/${encodeURIComponent(empresaId)}`, input);
  if (!result?.empresa) throw new Error('Resposta inválida ao atualizar empresa');
  return result.empresa;
}

export async function deleteEmpresa(empresaId) {
  await apiClient.delete(`/users/empresas/${encodeURIComponent(empresaId)}`);
}

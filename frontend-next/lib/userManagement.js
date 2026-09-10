import { apiClient } from '@/lib/apiClient';
import { normalizeRoleValue } from '@/lib/authRoles';

export function formatManageUserError(message) {
  const text = String(message || '').trim();
  if (text.includes('Limite de MEI atingido')) {
    return 'Esta empresa já atingiu o limite de vagas fiscais. Desative a emissão de outro usuário ou aumente o limite da empresa.';
  }
  if (text.includes('Limite de usuarios nao MEI')) {
    return 'Esta empresa já atingiu o limite de usuários PF / Outros.';
  }
  return text || 'Não foi possível concluir a operação.';
}

export async function listUsers(search) {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const result = await apiClient.get(`/users${q}`);
  const users = result?.users || [];
  return users.map((user) => ({
    ...user,
    role: normalizeRoleValue(user.role) || user.role,
  }));
}

export async function listEmpresas() {
  const result = await apiClient.get('/users/empresas');
  return result?.empresas || [];
}

export async function createUser(input) {
  try {
    return await apiClient.post('/users', { ...input, mei: input.mei === true });
  } catch (err) {
    throw new Error(formatManageUserError(err instanceof Error ? err.message : ''));
  }
}

export async function updateUser(userId, input) {
  try {
    return await apiClient.put(`/users/${encodeURIComponent(userId)}`, input);
  } catch (err) {
    throw new Error(formatManageUserError(err instanceof Error ? err.message : ''));
  }
}

export async function banUser(userId) {
  return apiClient.post(`/users/${encodeURIComponent(userId)}/ban`, { status: false });
}

export async function unbanUser(userId) {
  return apiClient.post(`/users/${encodeURIComponent(userId)}/unban`, {});
}

export async function deleteUser(userId) {
  return apiClient.delete(`/users/${encodeURIComponent(userId)}`);
}

export async function resetUserPassword(userId, password) {
  return apiClient.post(`/users/${encodeURIComponent(userId)}/reset-password`, { password });
}

import { apiClient } from '@/lib/apiClient';

export async function listPendingAccessRequests() {
  const data = await apiClient.get('/admin/access-requests/pending');
  return Array.isArray(data?.requests) ? data.requests : [];
}

export async function fetchAccessReport(limit = 50) {
  const data = await apiClient.get(`/admin/access-requests/report?limit=${limit}`);
  return Array.isArray(data?.entries) ? data.entries : [];
}

export async function manageAccessRequest(action, userId) {
  return apiClient.post('/admin/access-requests/manage', { action, userId });
}

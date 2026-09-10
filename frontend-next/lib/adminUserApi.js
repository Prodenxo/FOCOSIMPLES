import { apiClient } from '@/lib/apiClient';

export async function fetchAdminMeiCertificateStatus(userId) {
  return apiClient.get(`/admin/mei-guide/${encodeURIComponent(userId)}/certificate/status`);
}

export async function patchAdminMeiDocumentosAtivos(userId, documentosAtivos) {
  return apiClient.patch(
    `/admin/users/${encodeURIComponent(userId)}/mei-documentos-ativos`,
    { documentosAtivos },
  );
}

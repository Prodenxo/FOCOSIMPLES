import { apiClient } from '@/lib/apiClient';

export async function updateDisplayName(displayName) {
  return apiClient.post('/auth/update-display-name', { displayName });
}

export async function updatePhone(phone) {
  const data = await apiClient.post('/auth/update-phone', { phone });
  return data?.phone ?? phone;
}

export async function updateEmail(email) {
  return apiClient.post('/auth/update-email', { email });
}

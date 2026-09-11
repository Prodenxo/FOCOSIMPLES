import { apiClient } from '@/lib/apiClient';

export async function fetchActivationProgress() {
  try {
    return await apiClient.get('/users/me/activation');
  } catch {
    return null;
  }
}

export function isActivationCoreComplete(payload) {
  if (!payload?.progress) return true;
  const p = payload.progress;
  return Boolean(p.isCoreComplete ?? p.isComplete);
}

import { apiClient } from '@/lib/apiClient';

/** @param {'month'|'7d'|'today'} [period] */
export async function fetchOpenaiUsage(period = 'month') {
  return apiClient.get(`/admin/openai-usage?period=${encodeURIComponent(period)}`);
}

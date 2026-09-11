import { resolveAppOrigin } from '@/lib/appOrigin';
import { fetchMeiBillingStatus } from '@/lib/billingApi';

export async function shouldRequireMeiBillingRoute(role, mei) {
  if (resolveAppOrigin() === 'focosimples') return false;
  if (role === 'superadmin') return false;
  if (role !== 'admin') return false;
  try {
    const status = await fetchMeiBillingStatus();
    if (status?.required) return true;
    if (status && status.required === false && (status.maxMei ?? 0) > 0) {
      return mei !== true;
    }
    return Boolean(status?.required);
  } catch {
    return mei !== true;
  }
}

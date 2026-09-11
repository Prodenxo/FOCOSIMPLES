import { apiClient } from '@/lib/apiClient';

export async function fetchMeiBillingStatus() {
  return apiClient.get('/billing/mei/status');
}

export async function createSelfServeMeiCheckout(meiSlots) {
  return apiClient.post('/billing/mei/checkout', {
    meiSlots,
    billingTiming: 'checkout',
  });
}

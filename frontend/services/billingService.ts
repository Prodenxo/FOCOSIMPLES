import { apiClient } from '../lib/apiClient'
import type { MeiPublicPackage } from '../lib/meiBillingPricing'

export interface MeiBillingStatus {
  required: boolean
  maxMei: number | null
  hasActiveSubscription: boolean
  empresaId?: string
  packages?: MeiPublicPackage[]
}

export async function fetchMeiBillingStatus (): Promise<MeiBillingStatus> {
  return apiClient.get<MeiBillingStatus>('/billing/mei/status')
}

export async function createSelfServeMeiCheckout (
  meiSlots: number,
): Promise<{ checkoutUrl: string | null; pricing: { total: number; unit: number } }> {
  return apiClient.post('/billing/mei/checkout', {
    meiSlots,
    billingTiming: 'checkout',
  })
}

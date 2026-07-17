import { apiClient } from '../lib/apiClient';

export interface StripeMeiSubscriptionLine {
  id: string;
  empresa_id: string;
  mei_slots: number;
  status: string;
  value_numeric: number;
  billing_type: string;
  external_reference?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
}

export async function listStripeMeiSubscriptionLines(
  empresaId: string,
): Promise<{ lines: StripeMeiSubscriptionLine[] }> {
  const q = new URLSearchParams({ empresaId });
  return apiClient.get<{ lines: StripeMeiSubscriptionLine[] }>(
    `/admin/billing/stripe/subscription-lines?${q.toString()}`,
  );
}

export type BillingTimingOption = 'checkout' | 'next_cycle';

export interface CreateMeiStripeCheckoutInput {
  empresaId: string;
  meiSlots: number;
  billingTiming?: BillingTimingOption;
  description?: string;
  value?: number;
  externalReference?: string;
}

export interface CreateMeiStripeCheckoutResult {
  line: StripeMeiSubscriptionLine;
  checkoutUrl: string | null;
  billingTiming: string;
  pricing: { total: number; unit: number; tier: string };
  stripe?: { subscription: unknown };
}

export async function createMeiStripeCheckout(
  body: CreateMeiStripeCheckoutInput,
): Promise<CreateMeiStripeCheckoutResult> {
  return apiClient.post<CreateMeiStripeCheckoutResult>('/admin/billing/stripe/mei-checkout', body);
}

export async function syncMaxMeiFromStripeLines(empresaId: string): Promise<{ max_mei: number }> {
  return apiClient.post<{ max_mei: number }>('/admin/billing/stripe/sync-max-mei', { empresaId });
}

import { fetchMeiBillingStatus } from '@/services/billingService'
import { useAuthStore } from '@/store/authStore'

/**
 * Admin sem MEI pago precisa de /planos.
 * Também cobre falha da API: se role=admin e mei!==true, exige plano.
 */
export async function shouldRequireMeiBillingRoute (): Promise<boolean> {
  const { role, mei } = useAuthStore.getState()
  if (role === 'superadmin') return false
  if (role !== 'admin') return false

  try {
    const status = await fetchMeiBillingStatus()
    if (status?.required) return true
    // Já pagou / tem max_mei: só libera se mei estiver true no vínculo
    if (status && status.required === false && (status.maxMei ?? 0) > 0) {
      return mei !== true
    }
    return Boolean(status?.required)
  } catch {
    // Fail-closed para admin sem MEI: manda escolher plano em vez de entrar no app vazio
    return mei !== true
  }
}

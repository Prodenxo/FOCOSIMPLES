import { useAuthStore } from '../store/authStore'
import { isValidEmpresaCnpj } from './empresaCnpj'
import { fetchEmpresaCnpjOnboardingStatus } from '../services/empresaOnboardingService'
import { getEmpresa } from '../services/empresaService'

/**
 * Admin da empresa sem CNPJ válido na tabela `empresas`.
 * Usa API dedicada; se falhar, consulta GET /empresas/current como fallback.
 */
export async function isEmpresaCnpjOnboardingRequired (): Promise<boolean> {
  const role = useAuthStore.getState().role
  if (role !== 'admin') return false

  try {
    const status = await fetchEmpresaCnpjOnboardingStatus()
    if (status !== null) return Boolean(status.required)
  } catch {
    return false
  }

  try {
    const empresa = await getEmpresa()
    if (!empresa) return false
    return !isValidEmpresaCnpj(empresa.cnpj)
  } catch {
    return false
  }
}

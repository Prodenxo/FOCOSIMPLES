import { apiClient } from '../lib/apiClient'
import type { EmpresaFullData } from './empresaService'

export type EmpresaCnpjOnboardingStatus = {
  required: boolean
  empresa: EmpresaFullData | null
}

export type CompleteEmpresaCnpjOnboardingInput = EmpresaFullData & {
  confirmed: boolean
}

export async function fetchEmpresaCnpjOnboardingStatus (): Promise<EmpresaCnpjOnboardingStatus | null> {
  try {
    return await apiClient.get<EmpresaCnpjOnboardingStatus>('/users/empresas/current/cnpj-onboarding')
  } catch {
    return null
  }
}

export async function completeEmpresaCnpjOnboarding (
  input: CompleteEmpresaCnpjOnboardingInput,
): Promise<EmpresaFullData> {
  const res = await apiClient.post<{ empresa: EmpresaFullData; required: boolean }>(
    '/users/empresas/current/cnpj-onboarding',
    input,
  )
  if (!res?.empresa) throw new Error('Resposta inválida ao salvar CNPJ da empresa')
  return res.empresa
}

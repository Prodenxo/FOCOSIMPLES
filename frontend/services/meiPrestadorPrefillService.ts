import { apiClient } from '../lib/apiClient'
import { getMeiApiBaseUrl } from '../lib/runtimeEnv'
import { isLocalApiAuthMode } from '../lib/authMode'
import { supabase } from '../lib/supabase'
import { handleFunctionError } from '../lib/user-management'
import type { NfsePrestadorPrefillDto } from '../lib/nfsePrestadorPrefillDto'

const emptyPrefill = (): NfsePrestadorPrefillDto => ({
  prestadorCpfCnpj: null,
  prestadorRazaoSocial: null,
  prestadorEmail: null,
  prestadorInscricaoMunicipal: null,
  prestadorEndereco: null,
  sourceRowId: null,
})

const useBackendApi = () => Boolean(getMeiApiBaseUrl()) || isLocalApiAuthMode()

/**
 * Prefill NFSe a partir de `user_mei_certificates`.
 * Auth local / API: GET /mei-guide/prestador-prefill
 * Legacy: Edge Function `mei-prestador-prefill`
 */
export async function fetchNfsePrestadorPrefill (): Promise<NfsePrestadorPrefillDto> {
  if (useBackendApi()) {
    const data = await apiClient.get<{ prefill?: NfsePrestadorPrefillDto }>(
      '/mei-guide/prestador-prefill',
    )
    return data?.prefill ?? emptyPrefill()
  }

  const { data, error } = await supabase.functions.invoke<{
    prefill?: NfsePrestadorPrefillDto
    error?: string
  }>('mei-prestador-prefill', { body: {} })
  if (error) await handleFunctionError(error, 'Não foi possível carregar dados do prestador')
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }
  return data?.prefill ?? emptyPrefill()
}

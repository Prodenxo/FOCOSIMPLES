import { supabase } from '../lib/supabase';
import { handleFunctionError } from '../lib/user-management';
import type { NfsePrestadorPrefillDto } from '../lib/nfsePrestadorPrefillDto';

const emptyPrefill = (): NfsePrestadorPrefillDto => ({
  prestadorCpfCnpj: null,
  prestadorRazaoSocial: null,
  prestadorEmail: null,
  prestadorInscricaoMunicipal: null,
  prestadorEndereco: null,
  sourceRowId: null,
});

/**
 * Prefill NFSe a partir de `user_mei_certificates` (Edge Function `mei-prestador-prefill`).
 */
export async function fetchNfsePrestadorPrefill(): Promise<NfsePrestadorPrefillDto> {
  const { data, error } = await supabase.functions.invoke<{
    prefill?: NfsePrestadorPrefillDto;
    error?: string;
  }>('mei-prestador-prefill', { body: {} });
  if (error) await handleFunctionError(error, 'Não foi possível carregar dados do prestador');
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  return data?.prefill ?? emptyPrefill();
}

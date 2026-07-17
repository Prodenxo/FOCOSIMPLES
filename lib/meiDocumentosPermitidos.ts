import type { MeiDocType } from '../components/mei/meiFlowUi'

export type MeiDocumentosAtivosState = {
  nfse: boolean
  nfe: boolean
  nfce: boolean
}

/** Padrão seguro: só NFS-e até o admin liberar NF-e/NFC-e. */
export const DEFAULT_MEI_DOCUMENTOS_PERMITIDOS: MeiDocumentosAtivosState = {
  nfse: true,
  nfe: false,
  nfce: false,
}

type EmpresaFiscalDocFlags = {
  nfse?: { ativo?: boolean } | null
  nfe?: { ativo?: boolean } | null
  nfce?: { ativo?: boolean } | null
} | null | undefined

/**
 * Permissões efectivas para a UI: espelho admin (`documentos_ativos`) tem prioridade;
 * sem espelho, usa flags da empresa Plugnotas; senão só NFS-e.
 */
export function resolveMeiDocumentosPermitidos(
  mirror: MeiDocumentosAtivosState | null | undefined,
  empresa?: EmpresaFiscalDocFlags,
): MeiDocumentosAtivosState {
  if (mirror && (mirror.nfse || mirror.nfe || mirror.nfce)) {
    return {
      nfse: Boolean(mirror.nfse),
      nfe: Boolean(mirror.nfe),
      nfce: Boolean(mirror.nfce),
    }
  }
  if (empresa) {
    return {
      nfse: empresa.nfse?.ativo !== false,
      nfe: empresa.nfe?.ativo === true,
      nfce: empresa.nfce?.ativo === true,
    }
  }
  return { ...DEFAULT_MEI_DOCUMENTOS_PERMITIDOS }
}

export function meiDocTypesPermitidos(state: MeiDocumentosAtivosState): MeiDocType[] {
  const out: MeiDocType[] = []
  if (state.nfse) out.push('NFSE')
  if (state.nfe) out.push('NFE')
  if (state.nfce) out.push('NFCE')
  return out.length > 0 ? out : ['NFSE']
}

export function isMeiDocTypePermitido(
  documentType: MeiDocType,
  state: MeiDocumentosAtivosState,
): boolean {
  if (documentType === 'NFSE') return state.nfse
  if (documentType === 'NFE') return state.nfe
  if (documentType === 'NFCE') return state.nfce
  return false
}

export function primeiroMeiDocTypePermitido(state: MeiDocumentosAtivosState): MeiDocType {
  return meiDocTypesPermitidos(state)[0] ?? 'NFSE'
}

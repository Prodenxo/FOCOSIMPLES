/**
 * Metadados NFS-e (Reforma Tributária) gravados em `metadata_json` do catálogo de serviços.
 * Configurados pelo contador — na emissão o MEI só escolhe o serviço.
 */

/** LC 116 (6 dígitos) → NBS (9 dígitos) — subset alinhado ao backend. */
const LC116_NBS_SUGGESTIONS: Record<string, string> = {
  '140101': '120013110',
  '060301': '126023000',
  '170601': '114061100',
}

export type NfseCatalogProdutoItemMetadata = {
  codigoNbs?: string
  codigo_nbs?: string
  cIndOp?: string
  codigoOperacao?: string
}

export type NfseCatalogProdutoFormFields = {
  codigoNbs: string
  cIndOp: string
}

/** Texto de ajuda — código vem da LC 214 (Anexo VII), conforme orientação do contador. */
export const NFSE_CINDOP_FIELD_HINT =
  'Código de 6 dígitos da LC 214 (Anexo VII), conforme o tipo de serviço e onde ele é prestado. '
  + 'Use o código indicado pelo contador ou pela prefeitura — não há lista fixa no sistema.'

export function emptyNfseCatalogProdutoFormFields(): NfseCatalogProdutoFormFields {
  return { codigoNbs: '', cIndOp: '' }
}

/** Campos IBS/CBS no catálogo — só ao impersonar o cliente (contador configurando). */
export function canEditNfseReformaCatalogFields(
  _role: string | null | undefined,
  isImpersonating = false,
): boolean {
  return isImpersonating === true
}

const onlyDigits = (value: string, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

export function normalizeCodigoNbsInput(value: string): string {
  return onlyDigits(value, 9)
}

export function normalizeCIndOpInput(value: string): string {
  return onlyDigits(value, 6)
}

export function readNfseCatalogProdutoMetadata(raw: unknown): NfseCatalogProdutoItemMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const str = (key: string) => (typeof o[key] === 'string' ? o[key] : undefined)
  return {
    codigoNbs: str('codigoNbs') ?? str('codigo_nbs'),
    cIndOp: str('cIndOp') ?? str('codigoOperacao'),
    codigoOperacao: str('codigoOperacao') ?? str('cIndOp'),
  }
}

export function nfseCatalogProdutoFormFieldsFromMetadata(
  metadataJson: unknown,
): NfseCatalogProdutoFormFields {
  const meta = readNfseCatalogProdutoMetadata(metadataJson)
  return {
    codigoNbs: normalizeCodigoNbsInput(meta.codigoNbs ?? ''),
    cIndOp: normalizeCIndOpInput(meta.cIndOp ?? meta.codigoOperacao ?? ''),
  }
}

export function lookupSuggestedCodigoNbs(codigoLc116: string): string | null {
  const key = String(codigoLc116 || '').replace(/[^0-9A-Za-z]/g, '')
  if (!key) return null
  const padded = key.length >= 6 ? key.slice(0, 6) : key.padStart(6, '0')
  const nbs = LC116_NBS_SUGGESTIONS[padded] ?? LC116_NBS_SUGGESTIONS[key]
  if (!nbs || nbs.length !== 9) return null
  return nbs
}

export function validateNfseCatalogProdutoFormFields(
  fields: NfseCatalogProdutoFormFields,
): string | null {
  const cIndOp = normalizeCIndOpInput(fields.cIndOp)
  if (fields.cIndOp.trim() && cIndOp.length !== 6) {
    return 'Indicador de operação (cIndOp) deve ter 6 dígitos.'
  }
  // NBS incompleto não bloqueia — na gravação valores inválidos são ignorados.
  return null
}

export function buildNfseCatalogProdutoMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  fields: NfseCatalogProdutoFormFields,
): Record<string, unknown> {
  const base = existingMetadata && typeof existingMetadata === 'object' ? { ...existingMetadata } : {}
  const nbs = normalizeCodigoNbsInput(fields.codigoNbs)
  const cIndOp = normalizeCIndOpInput(fields.cIndOp)

  const next: Record<string, unknown> = { ...base }
  if (nbs.length === 9) {
    next.codigoNbs = nbs
    next.codigo_nbs = nbs
  } else {
    delete next.codigoNbs
    delete next.codigo_nbs
  }
  if (cIndOp.length === 6) {
    next.cIndOp = cIndOp
    next.codigoOperacao = cIndOp
  } else {
    delete next.cIndOp
    delete next.codigoOperacao
  }
  return next
}

/** Serviço sem cIndOp cadastrado — prefeituras ISSNET podem rejeitar. */
export function catalogProdutoNeedsNfseReformaCompletion(
  produto: { document_type?: string | null; metadata_json?: unknown },
): boolean {
  if (produto.document_type && produto.document_type !== 'NFSE') return false
  const fields = nfseCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  return !fields.cIndOp
}

export function applyCatalogProdutoToNfseServico(
  produto: {
    codigo?: string | null
    cnae?: string | null
    discriminacao?: string | null
    aliquota?: number | string | null
    valor_sugerido?: number | string | null
    metadata_json?: unknown
  },
) {
  const reforma = nfseCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  return {
    codigo: String(produto.codigo ?? '').trim(),
    cnae: produto.cnae ?? '',
    discriminacao: produto.discriminacao ?? '',
    aliquota: produto.aliquota != null ? String(produto.aliquota) : '',
    valorServico: produto.valor_sugerido != null ? String(produto.valor_sugerido) : '',
    ...(reforma.codigoNbs ? { codigoNbs: reforma.codigoNbs } : {}),
    ...(reforma.cIndOp ? { cIndOp: reforma.cIndOp } : {}),
  }
}

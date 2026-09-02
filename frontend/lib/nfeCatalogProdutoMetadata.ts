import type { DocumentType } from '../services/meiNotasService'
import { MEI_DEFAULT_NFE_CSOSN, MEI_DEFAULT_NFE_PIS_COFINS_CST } from './meiNfseForms'
import { inferCestFromProductDescription, normalizeCestInput } from './nfe-cest-packaging-hints'

/** Metadados NF-e / NFC-e gravados em `metadata_json` do catálogo de produtos. */
export type NfeCatalogProdutoItemMetadata = {
  ncm?: string
  cfop?: string
  unidade?: string
  icmsCsosn?: string
  pisCst?: string
  cofinsCst?: string
  cest?: string
  /** Produto sujeito a ST (ICMS recolhido na entrada). */
  hasSt?: boolean
}

export type NfeCatalogProdutoFormFields = {
  ncm: string
  cfop: string
  unidade: string
  icmsCsosn: string
  pisCst: string
  cofinsCst: string
  cest: string
}

const onlyDigits = (value: string, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

export function isNfeLikeCatalogDocumentType(documentType: string): boolean {
  return documentType === 'NFE' || documentType === 'NFCE'
}

export function emptyNfeCatalogProdutoFormFields(): NfeCatalogProdutoFormFields {
  return {
    ncm: '',
    cfop: '5102',
    unidade: 'UN',
    icmsCsosn: MEI_DEFAULT_NFE_CSOSN,
    pisCst: MEI_DEFAULT_NFE_PIS_COFINS_CST,
    cofinsCst: MEI_DEFAULT_NFE_PIS_COFINS_CST,
    cest: '',
  }
}

export function readNfeCatalogProdutoMetadata(raw: unknown): NfeCatalogProdutoItemMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const str = (key: string) => (typeof o[key] === 'string' ? o[key] : undefined)
  const bool = (key: string) => (typeof o[key] === 'boolean' ? o[key] : undefined)
  return {
    ncm: str('ncm'),
    cfop: str('cfop'),
    unidade: str('unidade'),
    icmsCsosn: str('icmsCsosn') ?? str('icms_csosn'),
    pisCst: str('pisCst') ?? str('pis_cst'),
    cofinsCst: str('cofinsCst') ?? str('cofins_cst'),
    cest: str('cest'),
    hasSt: bool('hasSt') ?? bool('has_st'),
  }
}

export function nfeCatalogProdutoFormFieldsFromMetadata(
  metadataJson: unknown,
): NfeCatalogProdutoFormFields {
  const meta = readNfeCatalogProdutoMetadata(metadataJson)
  const defaults = emptyNfeCatalogProdutoFormFields()
  return {
    ncm: onlyDigits(meta.ncm ?? '', 8),
    cfop: onlyDigits(meta.cfop ?? defaults.cfop, 4) || defaults.cfop,
    unidade: (meta.unidade ?? defaults.unidade).trim() || defaults.unidade,
    icmsCsosn: onlyDigits(meta.icmsCsosn ?? defaults.icmsCsosn, 3) || defaults.icmsCsosn,
    pisCst: onlyDigits(meta.pisCst ?? defaults.pisCst, 2) || defaults.pisCst,
    cofinsCst: onlyDigits(meta.cofinsCst ?? defaults.cofinsCst, 2) || defaults.cofinsCst,
    cest: normalizeCestInput(meta.cest ?? ''),
  }
}

export function buildNfeCatalogProdutoMetadata(
  existing: Record<string, unknown> | null | undefined,
  fields: NfeCatalogProdutoFormFields,
  options: { discriminacao?: string; hasSt?: boolean } = {},
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
  const cestManual = normalizeCestInput(fields.cest)
  const cestInferred = inferCestFromProductDescription(fields.ncm, options.discriminacao)
  const cest = cestManual || cestInferred || undefined

  return {
    ...base,
    ncm: onlyDigits(fields.ncm, 8),
    cfop: onlyDigits(fields.cfop, 4),
    unidade: String(fields.unidade || 'UN').trim() || 'UN',
    icmsCsosn: onlyDigits(fields.icmsCsosn, 3),
    pisCst: onlyDigits(fields.pisCst, 2),
    cofinsCst: onlyDigits(fields.cofinsCst, 2),
    ...(cest ? { cest } : {}),
    ...(options.hasSt === true ? { hasSt: true } : {}),
  }
}

export function validateNfeCatalogProdutoFormFields(
  fields: NfeCatalogProdutoFormFields,
): string | null {
  const ncm = onlyDigits(fields.ncm, 8)
  if (ncm.length !== 8) return 'Informe o NCM com 8 dígitos.'
  const cfop = onlyDigits(fields.cfop, 4)
  if (cfop.length !== 4) return 'Informe o CFOP com 4 dígitos.'
  if (!String(fields.unidade || '').trim()) return 'Informe a unidade (ex.: UN).'
  const csosn = onlyDigits(fields.icmsCsosn, 3)
  if (csosn.length !== 3) return 'Informe o CSOSN do ICMS com 3 dígitos (ex.: 102).'
  const pis = onlyDigits(fields.pisCst, 2)
  if (!pis) return 'Informe o CST do PIS (ex.: 49).'
  const cofins = onlyDigits(fields.cofinsCst, 2)
  if (!cofins) return 'Informe o CST do COFINS (ex.: 49).'
  const cest = normalizeCestInput(fields.cest)
  if (cest && cest.length !== 7) return 'CEST deve ter 7 dígitos ou ficar em branco.'
  return null
}

export function resolveCatalogProdutoNcm(
  produto: { metadata_json?: unknown; cnae?: string | null },
): string {
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  const fromMeta = onlyDigits(fields.ncm, 8)
  if (fromMeta.length === 8) return fromMeta
  const fromLegacyColumn = onlyDigits(String(produto.cnae ?? ''), 8)
  if (fromLegacyColumn.length === 8) return fromLegacyColumn
  return ''
}

function catalogProdutoHasPersistedNfeTributos(metadataJson: unknown): boolean {
  const meta = readNfeCatalogProdutoMetadata(metadataJson)
  return (
    onlyDigits(meta.cfop ?? '', 4).length === 4
    && onlyDigits(meta.icmsCsosn ?? '', 3).length === 3
    && onlyDigits(meta.pisCst ?? '', 2).length >= 2
    && onlyDigits(meta.cofinsCst ?? '', 2).length >= 2
  )
}

export function isCatalogProdutoUsableForNfeLike(
  produto: { document_type?: string | null; metadata_json?: unknown; cnae?: string | null },
  documentType: DocumentType,
): boolean {
  const dt = String(produto.document_type || '').toUpperCase()
  if (dt !== documentType && dt !== 'NFE' && dt !== 'NFCE') return false
  if (resolveCatalogProdutoNcm(produto).length !== 8) return false
  if (!catalogProdutoHasPersistedNfeTributos(produto.metadata_json)) return false
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  return validateNfeCatalogProdutoFormFields(fields) === null
}

/** Produto NF-e ainda sem NCM ou tributos completos para emitir. */
export function catalogProdutoNeedsNfeCompletion(
  produto: { metadata_json?: unknown; cnae?: string | null },
): boolean {
  if (resolveCatalogProdutoNcm(produto).length !== 8) return true
  if (!catalogProdutoHasPersistedNfeTributos(produto.metadata_json)) return true
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  return validateNfeCatalogProdutoFormFields(fields) !== null
}

import type { DocumentType } from '../services/meiNotasService'
import { MEI_DEFAULT_NFE_CSOSN, MEI_DEFAULT_NFE_PIS_COFINS_CST } from './meiNfseForms'

/** Metadados NF-e / NFC-e gravados em `metadata_json` do catálogo de produtos. */
export type NfeCatalogProdutoItemMetadata = {
  ncm?: string
  cfop?: string
  unidade?: string
  icmsCsosn?: string
  pisCst?: string
  cofinsCst?: string
}

export type NfeCatalogProdutoFormFields = {
  ncm: string
  cfop: string
  unidade: string
  icmsCsosn: string
  pisCst: string
  cofinsCst: string
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
  }
}

export function readNfeCatalogProdutoMetadata(raw: unknown): NfeCatalogProdutoItemMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const str = (key: string) => (typeof o[key] === 'string' ? o[key] : undefined)
  return {
    ncm: str('ncm'),
    cfop: str('cfop'),
    unidade: str('unidade'),
    icmsCsosn: str('icmsCsosn') ?? str('icms_csosn'),
    pisCst: str('pisCst') ?? str('pis_cst'),
    cofinsCst: str('cofinsCst') ?? str('cofins_cst'),
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
  }
}

export function buildNfeCatalogProdutoMetadata(
  existing: Record<string, unknown> | null | undefined,
  fields: NfeCatalogProdutoFormFields,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
  return {
    ...base,
    ncm: onlyDigits(fields.ncm, 8),
    cfop: onlyDigits(fields.cfop, 4),
    unidade: String(fields.unidade || 'UN').trim() || 'UN',
    icmsCsosn: onlyDigits(fields.icmsCsosn, 3),
    pisCst: onlyDigits(fields.pisCst, 2),
    cofinsCst: onlyDigits(fields.cofinsCst, 2),
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
  return null
}

export function isCatalogProdutoUsableForNfeLike(
  produto: { document_type?: string | null; metadata_json?: unknown },
  documentType: DocumentType,
): boolean {
  const dt = String(produto.document_type || '').toUpperCase()
  if (dt !== documentType && dt !== 'NFE' && dt !== 'NFCE') return false
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  return validateNfeCatalogProdutoFormFields(fields) === null
}

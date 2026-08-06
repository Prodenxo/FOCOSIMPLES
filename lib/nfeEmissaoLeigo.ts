/**
 * Regras de emissão NF-e para usuário leigo — CFOP por UF, defaults Simples Nacional, IE por documento.
 */

import type { NfeItemForm } from './meiNfseForms'
import {
  getDefaultNfeItem,
  MEI_DEFAULT_NFE_CSOSN,
  MEI_DEFAULT_NFE_PIS_COFINS_CST,
} from './meiNfseForms'
import type { DestinatarioIndIeDest } from './meiNfeDestinatarioIe'
import { DEFAULT_DESTINATARIO_IND_IE_DEST } from './meiNfeDestinatarioIe'

export const CFOP_VENDA_ESTADUAL = '5102'
export const CFOP_VENDA_INTERESTADUAL = '6102'

export type NfeVendaLocalizacao = 'estadual' | 'interestadual' | 'unknown'

const normalizeDoc = (value: string) => String(value ?? '').replace(/\D/g, '')

export function normalizeUf(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().slice(0, 2)
}

export function detectNfeVendaLocalizacao(
  emitenteUf: string | null | undefined,
  destinatarioUf: string | null | undefined,
): NfeVendaLocalizacao {
  const orig = normalizeUf(emitenteUf)
  const dest = normalizeUf(destinatarioUf)
  if (!orig || !dest) return 'unknown'
  return orig === dest ? 'estadual' : 'interestadual'
}

/** CFOP automático: 5102 (mesmo estado) ou 6102 (outro estado). */
export function resolveCfopByLocalizacao(
  emitenteUf: string | null | undefined,
  destinatarioUf: string | null | undefined,
): string | null {
  const scope = detectNfeVendaLocalizacao(emitenteUf, destinatarioUf)
  if (scope === 'unknown') return null
  return scope === 'estadual' ? CFOP_VENDA_ESTADUAL : CFOP_VENDA_INTERESTADUAL
}

export function applyCfopLocalizacaoToNfeItens<T extends Pick<NfeItemForm, 'cfop'>>(
  itens: T[],
  emitenteUf: string | null | undefined,
  destinatarioUf: string | null | undefined,
): T[] {
  const cfop = resolveCfopByLocalizacao(emitenteUf, destinatarioUf)
  if (!cfop) return itens
  return itens.map((item) => ({ ...item, cfop }))
}

export function isCpfDocument(doc: string): boolean {
  return normalizeDoc(doc).length === 11
}

export function isCnpjDocument(doc: string): boolean {
  return normalizeDoc(doc).length === 14
}

/** CPF → não contribuinte (9). CNPJ → contribuinte ICMS (1) até consulta/catálogo alterar. */
export function resolveIndIeDestFromDocument(doc: string): DestinatarioIndIeDest | null {
  if (isCpfDocument(doc)) return '9'
  if (isCnpjDocument(doc)) return '1'
  return null
}

export function resolveIndIeDestForDestinatario(
  doc: string,
  fromCatalogOrMeta?: DestinatarioIndIeDest | string | null,
): DestinatarioIndIeDest {
  if (fromCatalogOrMeta === '1' || fromCatalogOrMeta === '2' || fromCatalogOrMeta === '9') {
    return fromCatalogOrMeta
  }
  return resolveIndIeDestFromDocument(doc) ?? DEFAULT_DESTINATARIO_IND_IE_DEST
}

export function shouldShowDestinatarioIeOptions(doc: string): boolean {
  return isCnpjDocument(doc)
}

export function shouldShowDestinatarioInscricaoEstadual(
  indIEDest: DestinatarioIndIeDest,
  doc: string,
): boolean {
  return shouldShowDestinatarioIeOptions(doc) && indIEDest === '1'
}

/** Defaults Simples Nacional / MEI para novo item ou produto do catálogo. */
export function applySimplesNacionalDefaultsToNfeItem(item: NfeItemForm): NfeItemForm {
  const base = getDefaultNfeItem()
  return {
    ...item,
    unidade: String(item.unidade || 'UN').trim() || 'UN',
    tributos: {
      ...item.tributos,
      icms: {
        ...item.tributos.icms,
        origem: item.tributos.icms.origem || '0',
        csosn: item.tributos.icms.csosn || MEI_DEFAULT_NFE_CSOSN,
        cst: '',
      },
      pis: {
        ...item.tributos.pis,
        cst: item.tributos.pis.cst || MEI_DEFAULT_NFE_PIS_COFINS_CST,
      },
      cofins: {
        ...item.tributos.cofins,
        cst: item.tributos.cofins.cst || MEI_DEFAULT_NFE_PIS_COFINS_CST,
      },
    },
  }
}

export function getNfeLocalizacaoBanner(
  emitenteUf: string,
  destinatarioUf: string,
  localizacao: NfeVendaLocalizacao,
  cfop: string | null,
): string | null {
  if (localizacao === 'unknown' || !cfop) return null
  const orig = normalizeUf(emitenteUf)
  const dest = normalizeUf(destinatarioUf)
  if (localizacao === 'interestadual') {
    return (
      `Venda para outro estado (${orig} → ${dest}). CFOP ${cfop} aplicado automaticamente. ` +
      'Os impostos são calculados pelo emissor fiscal.'
    )
  }
  return (
    `Venda dentro do estado (${orig}). CFOP ${cfop} aplicado automaticamente. ` +
    'Os impostos são calculados pelo emissor fiscal.'
  )
}

export const NCM_OBRIGATORIO_HINT =
  'A SEFAZ exige o NCM com 8 dígitos para identificar o tipo de mercadoria. Consulte na nota do fornecedor ou em fiscosoft.com.br.'

export const NFE_CEP_LOOKUP_HINT =
  'Informe os 8 dígitos do CEP (inclua zeros à esquerda). Ex.: 50010000 (PE), 01310100 (SP), 21220290 (RJ).'

/** Extrai só os dígitos do CEP (máx. 8). Não adivinha dígito faltante — evita CEP errado fora de SP. */
export function normalizeCepForLookup(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 8)
}

export function isCepCompleteForLookup(raw: string): boolean {
  return normalizeCepForLookup(raw).length === 8
}

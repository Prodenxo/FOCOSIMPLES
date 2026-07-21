/** Validação e normalização — catálogo NFSe (serviços/produtos). */

import type { DocumentType } from '../services/meiNotasService'
import {
  buildNfeCatalogProdutoMetadata,
  emptyNfeCatalogProdutoFormFields,
  isNfeLikeCatalogDocumentType,
  type NfeCatalogProdutoFormFields,
  validateNfeCatalogProdutoFormFields,
} from './nfeCatalogProdutoMetadata'

export const NFSE_SERVICO_CODIGO_MIN_LENGTH = 6
export const CNAE_DIGITS_LENGTH = 7

export const CODIGO_CNAE_INTRO =
  'São campos diferentes:\n'
  + '• Código = item da lista da prefeitura (LC 116) para a NFS-e.\n'
  + '• CNAE = atividade da sua empresa (7 dígitos, Receita Federal).\n'
  + 'Não use o mesmo valor nos dois campos.'

export const CODIGO_SERVICO_LABEL = 'Código do serviço (LC 116 / prefeitura)'

export const CNAE_LABEL = 'CNAE (atividade económica)'

export const CODIGO_SERVICO_HINT =
  'Tabela da prefeitura (LC 116). Ex.: 14.01.01 — não é o CNAE.'

export const CNAE_HINT =
  'Atividade da empresa: 7 dígitos. Ex.: 4211102 (ou 4211-1/02).'

/** Alinhado ao backend `normalizeNfseServicoCodigoForLength`. */
export function normalizeCodigoServicoInput (value: string): string {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '')
}

/** CNAE = só dígitos, 7 caracteres. */
export function normalizeCnaeInput (value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, CNAE_DIGITS_LENGTH)
}

export function formatCnaeForDisplay (value: string): string {
  const d = normalizeCnaeInput(value)
  if (d.length !== CNAE_DIGITS_LENGTH) return String(value || '').trim()
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`
}

export interface ProdutoCatalogFormInput {
  codigo: string
  cnae: string
  discriminacao: string
  aliquotaStr: string
  valorSugeridoStr: string
  documentType?: DocumentType
  nfe?: NfeCatalogProdutoFormFields
}

export function validateProdutoCatalogForm (
  input: ProdutoCatalogFormInput,
  parseDecimal: (raw: string) => number | null,
): string | null {
  const discriminacao = input.discriminacao.trim()
  if (!discriminacao) return 'Discriminação é obrigatória.'

  const documentType = input.documentType || 'NFSE'
  if (isNfeLikeCatalogDocumentType(documentType)) {
    const codigo = String(input.codigo || '').trim()
    if (!codigo) return 'Informe o código/SKU do produto.'
    const nfeErr = validateNfeCatalogProdutoFormFields(
      input.nfe ?? emptyNfeCatalogProdutoFormFields(),
    )
    if (nfeErr) return nfeErr
    if (input.valorSugeridoStr.trim()) {
      const v = parseDecimal(input.valorSugeridoStr)
      if (v === null || v < 0) return 'Valor sugerido inválido.'
    }
    return null
  }

  const codigoNorm = normalizeCodigoServicoInput(input.codigo)
  if (!codigoNorm) {
    return 'Código do serviço (lista municipal / LC 116) é obrigatório.'
  }
  if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
    return (
      `Código do serviço deve ter pelo menos ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres `
      + '(ex.: 17.19.01 ou 140101 — não use só 17.19).'
    )
  }

  const cnaeNorm = normalizeCnaeInput(input.cnae)
  if (!cnaeNorm) return 'CNAE é obrigatório (7 dígitos).'
  if (cnaeNorm.length !== CNAE_DIGITS_LENGTH) {
    return `CNAE deve ter ${CNAE_DIGITS_LENGTH} dígitos (ex.: 4211102).`
  }

  if (codigoNorm === cnaeNorm) {
    return 'Código do serviço e CNAE não podem ser iguais. O código é da prefeitura (LC 116); o CNAE é a atividade com 7 dígitos.'
  }

  if (input.aliquotaStr.trim()) {
    const aliquota = parseDecimal(input.aliquotaStr)
    if (aliquota === null || aliquota < 0) return 'Alíquota inválida.'
  }

  if (input.valorSugeridoStr.trim()) {
    const v = parseDecimal(input.valorSugeridoStr)
    if (v === null || v < 0) return 'Valor sugerido inválido.'
  }

  return null
}

export function buildProdutoCatalogPayload (
  input: ProdutoCatalogFormInput,
  parseDecimal: (raw: string) => number | null,
  existingMetadata?: Record<string, unknown> | null,
) {
  const err = validateProdutoCatalogForm(input, parseDecimal)
  if (err) throw new Error(err)

  const valorOpt = input.valorSugeridoStr.trim()
    ? parseDecimal(input.valorSugeridoStr)
    : undefined

  const documentType = input.documentType || 'NFSE'
  if (isNfeLikeCatalogDocumentType(documentType)) {
    const nfeFields = input.nfe ?? emptyNfeCatalogProdutoFormFields()
    return {
      codigo: String(input.codigo || '').trim(),
      cnae: '',
      discriminacao: input.discriminacao.trim(),
      ...(valorOpt !== null && valorOpt !== undefined ? { valor_sugerido: valorOpt } : {}),
      metadata_json: buildNfeCatalogProdutoMetadata(existingMetadata, nfeFields),
    }
  }

  const aliquotaOpt = input.aliquotaStr.trim() ? parseDecimal(input.aliquotaStr) : null

  return {
    codigo: normalizeCodigoServicoInput(input.codigo),
    cnae: normalizeCnaeInput(input.cnae),
    discriminacao: input.discriminacao.trim(),
    ...(aliquotaOpt !== null && aliquotaOpt !== undefined ? { aliquota: aliquotaOpt } : {}),
    ...(valorOpt !== null && valorOpt !== undefined ? { valor_sugerido: valorOpt } : {}),
  }
}

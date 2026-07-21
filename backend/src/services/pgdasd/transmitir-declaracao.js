import { badRequest } from '../../utils/errors.js'
import { createSupabaseClient } from '../../config/supabase.js'
import { env } from '../../config/env.js'
import { PGDASD_SERVICOS } from './constants.js'
import { callPgdasdServico } from './client.js'

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
}

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Monta payload mínimo de declaração mensal PGDASD (TRANSDECLARACAO11).
 * Escopo Fase 2: receita interna do período (serviços) — o contador deve validar anexos.
 *
 * @param {{
 *   cnpj: string,
 *   periodoApuracao: string,
 *   valorReceitaInterna: number,
 *   valorReceitaExterna?: number,
 *   indicadorTransmissao?: boolean,
 * }} input
 */
export const buildDeclaracaoMensalPayload = (input = {}) => {
  const cnpj = String(input.cnpj || '').replace(/\D/g, '')
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ inválido para declaração PGDAS-D.')
  }
  const pa = normalizePeriodo(input.periodoApuracao)
  if (!pa) {
    throw badRequest('Período de apuração inválido (AAAAMM).')
  }
  const valorInterno = toNumber(input.valorReceitaInterna)
  if (valorInterno < 0) {
    throw badRequest('Valor de receita interna inválido.')
  }
  const valorExterno = toNumber(input.valorReceitaExterna)

  const ano = Number(pa.slice(0, 4))
  const mes = Number(pa.slice(4, 6))
  const receitasAnteriores = []
  for (let i = 1; i <= 12; i += 1) {
    let m = mes - i
    let y = ano
    while (m <= 0) {
      m += 12
      y -= 1
    }
    const paAnt = `${y}${String(m).padStart(2, '0')}`
    receitasAnteriores.push({
      pa: Number(paAnt),
      valorInterno: 0,
      valorExterno: 0,
    })
  }

  return {
    cnpjCompleto: cnpj,
    pa: Number(pa),
    indicadorTransmissao: input.indicadorTransmissao !== false,
    indicadorComparacao: false,
    declaracao: {
      tipoDeclaracao: 1,
      receitaBrutaPa: {
        valorCaixaInterno: valorInterno,
        valorCaixaExterno: valorExterno,
        valorCompetenciaInterno: valorInterno,
        valorCompetenciaExterno: valorExterno,
      },
      receitasBrutasAnteriores: receitasAnteriores,
    },
  }
}

/**
 * Soma faturamento NFS-e autorizadas do usuário no período AAAAMM.
 * @param {string} userId
 * @param {string} periodoApuracao
 */
export const sumNfseFaturamentoPeriodo = async (userId, periodoApuracao) => {
  const pa = normalizePeriodo(periodoApuracao)
  if (!userId || !pa) return { total: 0, count: 0 }

  const year = Number(pa.slice(0, 4))
  const month = Number(pa.slice(4, 6))
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()

  const db = createSupabaseClient({ useServiceRole: true })
  const { data, error } = await db
    .from('mei_nfse')
    .select('id, status, payload_json, created_at')
    .eq('user_id', userId)
    .eq('document_type', 'NFSE')
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(500)

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar NFS-e do período.')
  }

  let total = 0
  let count = 0
  for (const row of data || []) {
    const st = String(row.status || '').toLowerCase()
    if (st && !['autorizado', 'autorizada', 'concluido', 'concluído'].includes(st)) {
      continue
    }
    const servicos = row.payload_json?.servico
    const list = Array.isArray(servicos) ? servicos : servicos ? [servicos] : []
    for (const s of list) {
      const v = toNumber(s?.valor?.servico ?? s?.valorServico)
      if (v > 0) {
        total += v
        count += 1
      }
    }
  }
  return { total, count, periodoApuracao: pa }
}

/**
 * Transmite declaração mensal via TRANSDECLARACAO11.
 * @param {{ contribuinteCnpj: string, declaracao: object, userId?: string|null }} opts
 */
export const transmitirDeclaracaoMensal = async ({
  contribuinteCnpj,
  declaracao,
  userId = null,
}) => {
  if (!declaracao || typeof declaracao !== 'object') {
    throw badRequest('Payload de declaração obrigatório.')
  }
  if (String(env.APP_PRODUCT || '').toLowerCase() === 'focomei') {
    throw badRequest('Declaração PGDAS-D não se aplica ao produto MEI.')
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.TRANSDECLARACAO,
    dados: declaracao,
    modo: 'emitir',
    contribuinteCnpj,
    userId,
  })

  return { response, declaracao }
}

import { badRequest } from '../../utils/errors.js'
import { createSupabaseClient } from '../../config/supabase.js'
import { env } from '../../config/env.js'
import { PGDASD_SERVICOS } from './constants.js'
import { callPgdasdServico } from './client.js'
import {
  competenciaCivilFromIsoCreatedAt,
  extrairValorLimiteSimplesDaNota,
  isDocumentoLimiteSimplesRow,
  nfseDeveEntrarNoSomatorioLimite,
} from '../../utils/meiLimitePayloadSum.js'

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

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100

/**
 * PGDAS-D (domínio SERPRO):
 * 14 = serviço Anexo III, ISS no município do estabelecimento, sem retenção, sem fator r
 * 1  = revenda de mercadoria sem ST / monofásico
 */
export const PGDASD_ATIVIDADE_SERVICO_ANEXO_III = 14
export const PGDASD_ATIVIDADE_REVENDA_SEM_ST = 1

const ISS_OUTRO_MUNICIPIO_IDS = new Set([10, 13, 16, 19, 22, 25, 40])
const FATOR_R_ATIVIDADE_IDS = new Set([10, 11, 12, 29])

const toAtividadeId = (value, fallback) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 43) return fallback
  return n
}

const atividadeReceita = (idAtividade, valor, extra = {}) => {
  const parcela = { valor }
  const codigo = String(extra.codigoOutroMunicipio || '').replace(/\D/g, '')
  const uf = String(extra.outraUf || '').trim().toUpperCase().slice(0, 2)
  if (codigo) parcela.codigoOutroMunicipio = codigo
  if (uf) parcela.outraUf = uf
  return {
    idAtividade,
    valorAtividade: valor,
    receitasAtividade: [parcela],
  }
}

const parseCnpjList = (value) => {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/)
  const out = []
  for (const item of raw) {
    const digits = String(item || '').replace(/\D/g, '')
    if (digits.length === 14 && !out.includes(digits)) out.push(digits)
  }
  return out
}

export const getFolhaPeriodosFatorR = (periodoApuracao) => {
  const pa = normalizePeriodo(periodoApuracao)
  if (!pa) return []
  const year = Number(pa.slice(0, 4))
  const month = Number(pa.slice(4, 6))
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 2 - index, 1))
    return Number(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`)
  }).reverse()
}

const buildFolhasSalarioFatorR = (periodoApuracao, values) => {
  const required = getFolhaPeriodosFatorR(periodoApuracao)
  const byPeriodo = new Map(
    (Array.isArray(values) ? values : []).map((item) => [
      Number(normalizePeriodo(item?.pa)),
      roundMoney(item?.valor),
    ]),
  )
  const missing = required.filter((pa) => !byPeriodo.has(pa))
  if (missing.length) {
    throw badRequest('Informe a folha de salário dos 12 meses anteriores para calcular o Fator R.')
  }
  return required.map((pa) => ({ pa, valor: byPeriodo.get(pa) }))
}

/**
 * Parte o faturamento em serviço vs mercadoria. Se o contador só informar o total,
 * reaproveita a proporção das notas do mês (ou joga tudo em serviço se não houver nota).
 */
export const splitFaturamentoAtividades = ({
  valorTotal,
  valorServicos = 0,
  valorMercadorias = 0,
} = {}) => {
  const total = roundMoney(valorTotal)
  let servicos = roundMoney(valorServicos)
  let mercadorias = roundMoney(valorMercadorias)
  const conhecido = roundMoney(servicos + mercadorias)

  if (total <= 0) {
    return { servicos: 0, mercadorias: 0 }
  }
  if (conhecido <= 0) {
    return { servicos: total, mercadorias: 0 }
  }
  if (Math.abs(conhecido - total) < 0.015) {
    const resto = roundMoney(total - servicos)
    return { servicos, mercadorias: resto }
  }
  const ratio = total / conhecido
  servicos = roundMoney(servicos * ratio)
  mercadorias = roundMoney(total - servicos)
  return { servicos, mercadorias }
}

/**
 * Monta entrada TRANSDECLARACAO11 no formato da SERPRO.
 * O contador informa só o faturamento; CNPJ, competência e atividade saem do cadastro/notas.
 *
 * @param {{
 *   cnpj: string,
 *   periodoApuracao: string,
 *   valorReceitaInterna: number,
 *   valorReceitaExterna?: number,
 *   valorServicos?: number,
 *   valorMercadorias?: number,
 *   idAtividadeServico?: number,
 *   idAtividadeMercadoria?: number,
 *   codigoOutroMunicipio?: string,
 *   outraUf?: string,
 *   folhasSalario?: Array<{pa: number|string, valor: number}>,
 *   cnpjsFiliais?: string[]|string,
 *   tipoDeclaracao?: number,
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
  const valorInterno = roundMoney(input.valorReceitaInterna)
  if (valorInterno < 0) {
    throw badRequest('Valor de receita interna inválido.')
  }
  const valorExterno = roundMoney(input.valorReceitaExterna)
  const tipoDeclaracao = Number(input.tipoDeclaracao) === 2 ? 2 : 1
  const idServico = toAtividadeId(input.idAtividadeServico, PGDASD_ATIVIDADE_SERVICO_ANEXO_III)
  const idMercadoria = toAtividadeId(input.idAtividadeMercadoria, PGDASD_ATIVIDADE_REVENDA_SEM_ST)
  const issOutroMunicipio = {
    codigoOutroMunicipio: input.codigoOutroMunicipio,
    outraUf: input.outraUf,
  }
  if (ISS_OUTRO_MUNICIPIO_IDS.has(idServico)) {
    const codigo = String(input.codigoOutroMunicipio || '').replace(/\D/g, '')
    const uf = String(input.outraUf || '').trim().toUpperCase()
    if (codigo.length < 4 || uf.length !== 2) {
      throw badRequest('Informe o município e a UF do ISS em outro município.')
    }
  }

  // A Receita valida a soma das atividades contra a receita total do PA
  // (mercado interno + mercado externo), não apenas contra a parcela interna.
  const valorTotalPa = roundMoney(valorInterno + valorExterno)
  const { servicos, mercadorias } = splitFaturamentoAtividades({
    valorTotal: valorTotalPa,
    valorServicos: input.valorServicos,
    valorMercadorias: input.valorMercadorias,
  })

  const atividades = []
  if (servicos > 0) {
    atividades.push(atividadeReceita(idServico, servicos, issOutroMunicipio))
  }
  if (mercadorias > 0) {
    atividades.push(atividadeReceita(idMercadoria, mercadorias))
  }

  const estabelecimento = { cnpjCompleto: cnpj }
  if (atividades.length) estabelecimento.atividades = atividades

  const filiais = parseCnpjList(input.cnpjsFiliais).filter((doc) => doc !== cnpj)
  const estabelecimentos = [
    estabelecimento,
    ...filiais.map((doc) => ({ cnpjCompleto: doc })),
  ]

  const declaracao = {
    tipoDeclaracao,
    receitaPaCompetenciaInterno: valorInterno,
    receitaPaCompetenciaExterno: valorExterno,
    receitaPaCaixaInterno: null,
    receitaPaCaixaExterno: null,
    estabelecimentos,
  }
  if (servicos > 0 && FATOR_R_ATIVIDADE_IDS.has(idServico)) {
    declaracao.folhasSalario = buildFolhasSalarioFatorR(pa, input.folhasSalario)
  }

  return {
    cnpjCompleto: cnpj,
    pa: Number(pa),
    indicadorTransmissao: input.indicadorTransmissao !== false,
    indicadorComparacao: false,
    declaracao,
  }
}

/**
 * Soma notas concluídas (NFS-e + NF-e + NFC-e) no período AAAAMM.
 * @param {object[]} rows
 */
export const aggregateNotasFaturamentoPeriodo = (rows, periodoApuracao) => {
  const pa = normalizePeriodo(periodoApuracao)
  let total = 0
  let count = 0
  const porTipo = { NFSE: 0, NFE: 0, NFCE: 0 }
  const totalPorTipo = { NFSE: 0, NFE: 0, NFCE: 0 }
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isDocumentoLimiteSimplesRow(row)) continue
    if (!nfseDeveEntrarNoSomatorioLimite(row.status)) continue
    if (pa && competenciaCivilFromIsoCreatedAt(row.created_at) !== pa) continue
    const valor = extrairValorLimiteSimplesDaNota(row)
    if (valor === null || valor < 0) continue
    total += valor
    count += 1
    const dt = String(row.document_type || '').toUpperCase()
    if (Object.prototype.hasOwnProperty.call(porTipo, dt)) {
      porTipo[dt] += 1
      totalPorTipo[dt] += valor
    }
  }
  return {
    total: roundMoney(total),
    count,
    porTipo,
    totalPorTipo: {
      NFSE: roundMoney(totalPorTipo.NFSE),
      NFE: roundMoney(totalPorTipo.NFE),
      NFCE: roundMoney(totalPorTipo.NFCE),
    },
    valorServicos: roundMoney(totalPorTipo.NFSE),
    valorMercadorias: roundMoney(totalPorTipo.NFE + totalPorTipo.NFCE),
    periodoApuracao: pa,
  }
}

/**
 * Soma faturamento de notas autorizadas do usuário no período AAAAMM.
 * @param {string} userId
 * @param {string} periodoApuracao
 */
export const sumNfseFaturamentoPeriodo = async (userId, periodoApuracao) => {
  const pa = normalizePeriodo(periodoApuracao)
  if (!userId || !pa) {
    return {
      total: 0,
      count: 0,
      porTipo: { NFSE: 0, NFE: 0, NFCE: 0 },
      totalPorTipo: { NFSE: 0, NFE: 0, NFCE: 0 },
      valorServicos: 0,
      valorMercadorias: 0,
      periodoApuracao: pa,
    }
  }

  const year = Number(pa.slice(0, 4))
  const month = Number(pa.slice(4, 6))
  const start = new Date(Date.UTC(year, month - 1, 1) - 4 * 86400000).toISOString()
  const end = new Date(Date.UTC(year, month, 1) + 4 * 86400000).toISOString()

  const db = createSupabaseClient({ useServiceRole: true })
  const { data, error } = await db
    .from('mei_nfse')
    .select('id, status, document_type, payload_json, response_json, created_at')
    .eq('user_id', userId)
    .in('document_type', ['NFSE', 'NFE', 'NFCE'])
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(500)

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar notas do período.')
  }

  return aggregateNotasFaturamentoPeriodo(data, pa)
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
    modo: 'declarar',
    contribuinteCnpj,
    userId,
  })

  return { response, declaracao }
}

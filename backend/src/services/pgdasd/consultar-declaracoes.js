import { PGDASD_SERVICOS } from './constants.js'
import { callPgdasdServico } from './client.js'

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
}

const periodoToCompetencia = (periodo) => {
  const p = normalizePeriodo(periodo)
  if (!p) return null
  return `${p.slice(0, 4)}-${p.slice(4, 6)}`
}

const parseDados = (response) => {
  const raw = response?.dados
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return raw
  }
}

/**
 * Lista declarações / operações PGDASD por ano-calendário.
 * @param {{ contribuinteCnpj: string, anoCalendario?: number, userId?: string|null }} opts
 */
export const consultarDeclaracoesPorAno = async ({
  contribuinteCnpj,
  anoCalendario = new Date().getFullYear(),
  userId = null,
}) => {
  const ano = Number(anoCalendario)
  if (!Number.isInteger(ano) || ano < 2018 || ano > 2100) {
    throw new Error('Ano-calendário inválido')
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.CONSDECLARACAO,
    dados: { anoCalendario: ano },
    modo: 'consultar',
    contribuinteCnpj,
    userId,
  })

  return {
    response,
    dados: parseDados(response),
  }
}

/**
 * Consulta operações de um único período (AAAAMM).
 * @param {{ contribuinteCnpj: string, periodoApuracao: string, userId?: string|null }} opts
 */
export const consultarDeclaracoesPorPeriodo = async ({
  contribuinteCnpj,
  periodoApuracao,
  userId = null,
}) => {
  const periodo = normalizePeriodo(periodoApuracao)
  if (!periodo) {
    throw new Error('Período de apuração inválido')
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.CONSDECLARACAO,
    dados: { periodoApuracao: periodo },
    modo: 'consultar',
    contribuinteCnpj,
    userId,
  })

  return {
    response,
    dados: parseDados(response),
    periodo,
  }
}

/**
 * Resolve numeroDas (e numeroDeclaracao) para um período via CONSDECLARACAO.
 * @returns {Promise<{ numeroDas: string|null, numeroDeclaracao: string|null, status: string }>}
 */
export const resolveDasIdsDoPeriodo = async ({
  contribuinteCnpj,
  periodoApuracao,
  userId = null,
}) => {
  const { dados, periodo } = await consultarDeclaracoesPorPeriodo({
    contribuinteCnpj,
    periodoApuracao,
    userId,
  })
  let mapped = mapDeclaracoesToPeriods(dados)
  let row = mapped.find((p) => p.periodoApuracao === periodo) || null

  if (!row?.numeroDas) {
    const ano = Number(periodo.slice(0, 4))
    if (Number.isInteger(ano)) {
      const { dados: dadosAno } = await consultarDeclaracoesPorAno({
        contribuinteCnpj,
        anoCalendario: ano,
        userId,
      })
      mapped = mapDeclaracoesToPeriods(dadosAno)
      row = mapped.find((p) => p.periodoApuracao === periodo) || row
    }
  }

  return {
    numeroDas: row?.numeroDas || null,
    numeroDeclaracao: row?.numeroDeclaracao || null,
    status: row?.status || 'a_pagar',
  }
}

const isDasGenerationTipo = (tipo) =>
  /gera[cç][aã]o\s+de\s+das|das\s+avulso|das\s+medida|das\s+cobran[cç]a/i.test(String(tipo || ''))

const isPaymentTipo = (tipo) =>
  /pag(o|amento)|quitad|liquid/i.test(String(tipo || ''))

const isDeclaracaoTipo = (tipo) =>
  /declara[cç][aã]o\s+(original|retificadora)/i.test(String(tipo || ''))

/**
 * Escolhe o melhor numeroDas das operações do período.
 * Prefere DAS pago; senão o de emissão mais recente.
 * @param {object[]} operacoes
 * @returns {string|null}
 */
const normalizeNumeroDas = (raw) => {
  if (raw == null || String(raw).trim() === '') return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(0, 17)
  return String(raw).trim()
}

export const pickNumeroDasFromOperacoes = (operacoes = []) => {
  let bestPaid = null
  let bestAny = null
  for (const op of Array.isArray(operacoes) ? operacoes : []) {
    if (!op || typeof op !== 'object') continue
    const indiceDas = op.indiceDas || op.IndiceDas || null
    const rawCandidates = [
      indiceDas?.numeroDas,
      indiceDas?.NumeroDas,
      indiceDas?.numeroDocumento,
      indiceDas?.NumeroDocumento,
      op.numeroDas,
      op.NumeroDas,
      op.numeroDocumento,
      op.NumeroDocumento,
    ]
    const numeroDas = rawCandidates.map(normalizeNumeroDas).find(Boolean)
    if (!numeroDas) continue
    const dataHora = Number(
      indiceDas?.dataHoraEmissaoDas
      || indiceDas?.DataHoraEmissaoDas
      || op.dataHoraEmissaoDas
      || op.DataHoraEmissaoDas
      || 0,
    ) || 0
    const pago = indiceDas?.dasPago === true
      || indiceDas?.DasPago === true
      || op.pago === true
    const entry = { numeroDas, dataHora }
    if (pago) {
      if (!bestPaid || entry.dataHora >= bestPaid.dataHora) bestPaid = entry
    }
    if (!bestAny || entry.dataHora >= bestAny.dataHora) bestAny = entry
  }
  return bestPaid?.numeroDas || bestAny?.numeroDas || null
}

/**
 * Status a partir do índice oficial CONSDECLARACAO13 (sem gravar no banco):
 * - dasPago=true → pago
 * - houve Geração de DAS / DAS Avulso / Cobrança sem pagamento → a_pagar
 * - só declaração (sem geração de DAS) → pago (sem valor devido / nada a emitir)
 */
export const resolvePeriodStatusFromOperacoes = (operacoes = []) => {
  const ops = Array.isArray(operacoes) ? operacoes : []
  let hasDasGerado = false
  let hasDasPago = false
  let hasDeclaracao = false
  let tipoPrincipal = null

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue
    const tipo = String(op.tipoOperacao || op.tipo || '')
    if (!tipoPrincipal) tipoPrincipal = tipo || null

    const indiceDas = op.indiceDas || op.IndiceDas || null
    if (indiceDas && typeof indiceDas === 'object') {
      hasDasGerado = true
      if (indiceDas.dasPago === true || indiceDas.DasPago === true) {
        hasDasPago = true
      }
    }

    if (isPaymentTipo(tipo) || op.pago === true) {
      hasDasPago = true
      tipoPrincipal = tipo || tipoPrincipal
    }
    if (isDasGenerationTipo(tipo)) {
      hasDasGerado = true
      tipoPrincipal = tipo || tipoPrincipal
    }
    if (isDeclaracaoTipo(tipo)) {
      hasDeclaracao = true
    }
  }

  if (hasDasPago) {
    return { status: 'pago', tipoOperacao: tipoPrincipal }
  }
  if (hasDasGerado) {
    return { status: 'a_pagar', tipoOperacao: tipoPrincipal }
  }
  if (hasDeclaracao || ops.length > 0) {
    // Declaração transmitida sem geração de DAS = sem valor devido (não há PDF de arrecadação).
    return { status: 'sem_debito', tipoOperacao: tipoPrincipal || 'Sem geração de DAS' }
  }
  return { status: 'a_pagar', tipoOperacao: tipoPrincipal }
}

/**
 * Normaliza retorno CONSDECLARACAO13 em lista de competências para a UI.
 * Agrega todas as operações do período antes de decidir o status.
 * @param {unknown} dados
 * @returns {Array<{ competencia: string, periodoApuracao: string, status: string, tipoOperacao?: string, numeroDeclaracao?: string|null }>}
 */
export const mapDeclaracoesToPeriods = (dados) => {
  /** @type {Map<string, { ops: object[], numeroDeclaracao: string|null }>} */
  const byPeriodo = new Map()

  const addOps = (periodoApuracao, ops, numeroDeclaracao = null) => {
    const periodo = normalizePeriodo(periodoApuracao)
    if (!periodo) return
    const prev = byPeriodo.get(periodo) || { ops: [], numeroDeclaracao: null }
    const list = Array.isArray(ops) ? ops : [ops]
    for (const op of list) {
      if (op && typeof op === 'object') prev.ops.push(op)
    }
    if (numeroDeclaracao && !prev.numeroDeclaracao) {
      prev.numeroDeclaracao = String(numeroDeclaracao)
    }
    byPeriodo.set(periodo, prev)
  }

  const walk = (node) => {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node !== 'object') return

    const pa = node.periodoApuracao || node.periodo_apuracao || node.pa
    if (pa && (node.operacoes || node.tipoOperacao || node.indiceDeclaracao || node.indiceDas)) {
      const ops = Array.isArray(node.operacoes) ? node.operacoes : [node]
      const numero = ops
        .map((op) => op?.indiceDeclaracao?.numeroDeclaracao || op?.numeroDeclaracao)
        .find(Boolean)
        || node.numeroDeclaracao
        || null
      addOps(pa, ops, numero)
    }

    if (Array.isArray(node.periodos)) {
      for (const p of node.periodos) walk(p)
    }
    if (node.periodo) walk(node.periodo)

    for (const [key, value] of Object.entries(node)) {
      if (key === 'periodos' || key === 'periodo') continue
      if (value && typeof value === 'object') walk(value)
    }
  }

  walk(dados)

  const out = []
  for (const [periodo, bag] of byPeriodo.entries()) {
    const resolved = resolvePeriodStatusFromOperacoes(bag.ops)
    const numeroDas = pickNumeroDasFromOperacoes(bag.ops)
    out.push({
      competencia: periodoToCompetencia(periodo),
      periodoApuracao: periodo,
      status: resolved.status,
      tipoOperacao: resolved.tipoOperacao,
      numeroDeclaracao: bag.numeroDeclaracao,
      numeroDas,
      hasDas: Boolean(numeroDas),
      guideId: `pgdasd-${periodo}`,
    })
  }

  out.sort((a, b) => String(b.periodoApuracao).localeCompare(String(a.periodoApuracao)))
  return out
}

/**
 * Monta fallback local dos últimos N meses quando SERPRO não devolve lista.
 * @param {number} [count=12]
 */
export const buildFallbackPeriodList = (count = 12) => {
  const now = new Date()
  const rows = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const periodo = `${y}${m}`
    rows.push({
      competencia: `${y}-${m}`,
      periodoApuracao: periodo,
      status: 'a_pagar',
      tipoOperacao: null,
      numeroDeclaracao: null,
      guideId: `pgdasd-${periodo}`,
      fromFallback: true,
    })
  }
  return rows
}

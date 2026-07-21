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
 * Normaliza retorno CONSDECLARACAO13 em lista de competências para a UI.
 * @param {unknown} dados
 * @returns {Array<{ competencia: string, periodoApuracao: string, status: string, tipoOperacao?: string, numeroDeclaracao?: string|null }>}
 */
export const mapDeclaracoesToPeriods = (dados) => {
  const out = []
  const seen = new Set()

  const pushPeriod = (periodoApuracao, meta = {}) => {
    const periodo = normalizePeriodo(periodoApuracao)
    if (!periodo || seen.has(periodo)) return
    seen.add(periodo)
    const competencia = periodoToCompetencia(periodo)
    const tipo = String(meta.tipoOperacao || '').toLowerCase()
    let status = 'a_pagar'
    if (meta.pago === true || /pag(o|amento)|quitad|liquid/i.test(tipo)) {
      status = 'pago'
    } else if (/sem\s*d[eé]bito|sem\s*valor|sem\s*das/i.test(tipo)) {
      status = 'indisponivel'
    }
    out.push({
      competencia,
      periodoApuracao: periodo,
      status,
      tipoOperacao: meta.tipoOperacao || null,
      numeroDeclaracao: meta.numeroDeclaracao || null,
      guideId: `pgdasd-${periodo}`,
    })
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
      for (const op of ops) {
        const tipo = String(op.tipoOperacao || node.tipoOperacao || '')
        const pagoHint = /pag(o|amento)|quitad|liquid/i.test(tipo)
          || op.pago === true
          || node.pago === true
        pushPeriod(pa, {
          tipoOperacao: op.tipoOperacao || node.tipoOperacao,
          numeroDeclaracao: op.indiceDeclaracao?.numeroDeclaracao
            || op.numeroDeclaracao
            || node.numeroDeclaracao,
          pago: pagoHint,
        })
      }
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

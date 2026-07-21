/**
 * Orquestração DAS Simples Nacional (PGDAS-D).
 * Paralelo a mei-guide.service.js (PGMEI), sem misturar os dois fluxos.
 */

import { env } from '../config/env.js'
import { badRequest } from '../utils/errors.js'
import { getCertificateDocument } from './mei-certificate-store.js'
import {
  assertPgdasdSerproConfigured,
  inspectPgdasdSerproConfig,
} from './pgdasd/client.js'
import { PGDASD_PORTAL_URL, SIMPLES_DAS_NOT_CONFIGURED } from './pgdasd/constants.js'
import {
  buildFallbackPeriodList,
  consultarDeclaracoesPorAno,
  mapDeclaracoesToPeriods,
} from './pgdasd/consultar-declaracoes.js'
import { gerarDasPgdasd } from './pgdasd/gerar-das.js'
import {
  getDasSimplesByPeriodo,
  listDasSimplesPeriods,
  upsertDasSimples,
} from './pgdasd/das-simples-store.js'
import {
  buildDeclaracaoMensalPayload,
  sumNfseFaturamentoPeriodo,
  transmitirDeclaracaoMensal,
} from './pgdasd/transmitir-declaracao.js'

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '')

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
}

const resolveContribuinteCnpj = async (userId, cnpjHint) => {
  const fromHint = normalizeDoc(cnpjHint)
  if (fromHint.length === 14) return fromHint
  const fromCert = normalizeDoc(await getCertificateDocument(userId))
  if (fromCert.length === 14) return fromCert
  throw badRequest('Informe um CNPJ válido ou envie o certificado A1 da empresa.')
}

export const getSimplesDasIntegrationStatus = () => {
  const cfg = inspectPgdasdSerproConfig()
  return {
    product: String(env.APP_PRODUCT || '').toLowerCase() || 'focosimples',
    configured: cfg.configured,
    missing: cfg.missing,
    portalUrl: PGDASD_PORTAL_URL,
    message: cfg.configured
      ? null
      : SIMPLES_DAS_NOT_CONFIGURED,
  }
}

/**
 * Lista competências (declarações SERPRO + cache local).
 */
export const listSimplesDasPeriods = async (userId, { cnpj, ano, refresh = false } = {}) => {
  const integration = getSimplesDasIntegrationStatus()
  const contribuinteCnpj = await resolveContribuinteCnpj(userId, cnpj)
  const year = Number(ano) || new Date().getFullYear()

  let remote = []
  let remoteError = null
  if (integration.configured) {
    try {
      assertPgdasdSerproConfigured()
      const { dados } = await consultarDeclaracoesPorAno({
        contribuinteCnpj,
        anoCalendario: year,
        userId,
      })
      remote = mapDeclaracoesToPeriods(dados)
      // Também tenta ano anterior se lista vazia (virada de ano).
      if (remote.length === 0 && !refresh) {
        const prev = await consultarDeclaracoesPorAno({
          contribuinteCnpj,
          anoCalendario: year - 1,
          userId,
        })
        remote = mapDeclaracoesToPeriods(prev.dados)
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : String(err)
    }
  }

  let local = []
  try {
    local = await listDasSimplesPeriods({ userId, limit: 24 })
  } catch {
    local = []
  }

  const byPeriodo = new Map()

  // Só competências reais da Receita (ou cache local). Não inventar 12 meses "a pagar".
  for (const row of remote) {
    byPeriodo.set(row.periodoApuracao, {
      ...row,
      errorMessage: null,
    })
  }
  for (const row of local) {
    const periodo = row.periodo_apuracao
    if (!periodo) continue
    const prev = byPeriodo.get(periodo) || {
      competencia: row.competencia,
      periodoApuracao: periodo,
      guideId: `pgdasd-${periodo}`,
      status: 'a_pagar',
    }
    const localStatus = String(row.status || '')
    let status = prev.status || 'a_pagar'
    if (localStatus === 'sem_debito') status = 'indisponivel'
    else if (localStatus === 'pago') status = 'pago'
    else if (localStatus === 'gerado' && row.pdf_base64) status = 'a_pagar'
    byPeriodo.set(periodo, {
      ...prev,
      status,
      guideId: row.id || prev.guideId,
      errorMessage: row.error_message || prev.errorMessage || null,
      valorTotal: row.valor_total ?? null,
      numeroDocumento: row.numero_documento || null,
      hasLocalPdf: Boolean(row.pdf_base64),
    })
  }

  // Sem retorno SERPRO e sem cache: lista vazia (UI mostra remoteError / orientação).
  if (byPeriodo.size === 0 && !integration.configured) {
    for (const row of buildFallbackPeriodList(3)) {
      byPeriodo.set(row.periodoApuracao, {
        ...row,
        status: 'erro',
        errorMessage: integration.message,
        guideId: `pgdasd-${row.periodoApuracao}`,
      })
    }
  }

  const periods = Array.from(byPeriodo.values())
    .sort((a, b) => String(b.periodoApuracao).localeCompare(String(a.periodoApuracao)))

  return {
    cnpj: contribuinteCnpj,
    integration,
    periods,
    remoteError,
    portalUrl: PGDASD_PORTAL_URL,
  }
}

/**
 * Gera DAS e persiste PDF.
 */
export const gerarSimplesDas = async (userId, payload = {}) => {
  assertPgdasdSerproConfigured()
  // Auth PGDASD usa SERPRO_CERT_* (contratante). A1 do cliente não é exigido aqui.
  const contribuinteCnpj = await resolveContribuinteCnpj(userId, payload.cnpj)
  const periodo = normalizePeriodo(payload.periodoApuracao || payload.periodo)
  if (!periodo) {
    throw badRequest('Informe periodoApuracao (AAAAMM).')
  }

  const result = await gerarDasPgdasd({
    contribuinteCnpj,
    periodoApuracao: periodo,
    dataConsolidacao: payload.dataConsolidacao || null,
    userId,
  }).catch(async (err) => {
    const code = err?.errors?.code || err?.code
    if (code === 'PGDASD_SEM_DEBITO') {
      try {
        await upsertDasSimples({
          userId,
          cnpj: contribuinteCnpj,
          periodoApuracao: periodo,
          status: 'sem_debito',
          pdfBase64: null,
          errorMessage: err.message,
        })
      } catch {
        /* ignore persist failure */
      }
    }
    throw err
  })

  const saved = await upsertDasSimples({
    userId,
    cnpj: contribuinteCnpj,
    periodoApuracao: periodo,
    status: 'gerado',
    pdfBase64: result.pdfBase64,
    numeroDocumento: result.numeroDocumento,
    valorTotal: result.valorTotal,
    detalhamento: result.detalhamento,
  })

  return {
    id: saved?.id || `pgdasd-${periodo}`,
    status: 'gerado',
    competencia: result.competencia,
    periodoApuracao: periodo,
    numeroDocumento: result.numeroDocumento,
    valorTotal: result.valorTotal,
    pdfBase64: result.pdfBase64,
    filename: `DAS-SN-${periodo}.pdf`,
  }
}

/**
 * Download PDF (cache local ou regenera).
 */
export const downloadSimplesDas = async (userId, idOrPeriodo, { regenerate = false } = {}) => {
  const raw = String(idOrPeriodo || '')
  const periodoFromId = raw.startsWith('pgdasd-') ? raw.slice('pgdasd-'.length) : raw
  const periodo = normalizePeriodo(periodoFromId) || normalizePeriodo(raw.replace(/\D/g, '').slice(-6))

  if (!periodo) {
    throw badRequest('Identificador/período inválido.')
  }

  if (!regenerate) {
    try {
      const local = await getDasSimplesByPeriodo({ userId, periodoApuracao: periodo })
      if (local?.pdf_base64) {
        return {
          id: local.id,
          status: local.status || 'gerado',
          periodoApuracao: periodo,
          competencia: local.competencia,
          pdfBase64: local.pdf_base64,
          filename: `DAS-SN-${periodo}.pdf`,
          contentType: 'application/pdf',
        }
      }
    } catch {
      /* regenera */
    }
  }

  return gerarSimplesDas(userId, { periodoApuracao: periodo })
}

/**
 * Preview de faturamento NFS-e do período (Fase 2).
 */
export const getSimplesDasFaturamento = async (userId, periodoApuracao) => {
  const periodo = normalizePeriodo(periodoApuracao)
  if (!periodo) throw badRequest('Período inválido.')
  const cnpj = await resolveContribuinteCnpj(userId)
  const fat = await sumNfseFaturamentoPeriodo(userId, periodo)
  const draft = buildDeclaracaoMensalPayload({
    cnpj,
    periodoApuracao: periodo,
    valorReceitaInterna: fat.total,
    indicadorTransmissao: false,
  })
  return {
    cnpj,
    ...fat,
    draftPreview: draft,
    aviso:
      'A transmissão oficial (TRANSDECLARACAO11) exige validação contábil dos anexos. Use POST /declarar com confirm=true após revisar.',
  }
}

/**
 * Transmite declaração PGDAS-D (Fase 2).
 */
export const declararSimplesDas = async (userId, payload = {}) => {
  assertPgdasdSerproConfigured()
  if (payload.confirm !== true) {
    throw badRequest(
      'Confirme a transmissão com confirm=true após revisar o rascunho (risco fiscal).',
      { code: 'PGDASD_DECLARAR_CONFIRM_REQUIRED' },
    )
  }
  const cnpj = await resolveContribuinteCnpj(userId, payload.cnpj)
  const periodo = normalizePeriodo(payload.periodoApuracao)
  if (!periodo) throw badRequest('Informe periodoApuracao.')

  let declaracao = payload.declaracao
  if (!declaracao) {
    let valor = Number(payload.valorReceitaInterna)
    if (!Number.isFinite(valor)) {
      const fat = await sumNfseFaturamentoPeriodo(userId, periodo)
      valor = fat.total
    }
    declaracao = buildDeclaracaoMensalPayload({
      cnpj,
      periodoApuracao: periodo,
      valorReceitaInterna: valor,
      valorReceitaExterna: payload.valorReceitaExterna,
      indicadorTransmissao: true,
    })
  }

  const { response } = await transmitirDeclaracaoMensal({
    contribuinteCnpj: cnpj,
    declaracao,
    userId,
  })

  return {
    ok: true,
    periodoApuracao: periodo,
    cnpj,
    responseStatus: response?.status || null,
    dados: response?.dados || null,
  }
}

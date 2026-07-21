/**
 * Orquestração DAS Simples Nacional (PGDAS-D).
 * Paralelo a mei-guide.service.js (PGMEI), sem misturar os dois fluxos.
 */

import { env } from '../config/env.js'
import { badRequest } from '../utils/errors.js'
import { getCertificateDocument, hasCertificatePfx } from './mei-certificate-store.js'
import {
  assertPgdasdSerproConfigured,
  inspectPgdasdSerproConfig,
} from './pgdasd/client.js'
import { PGDASD_PORTAL_URL, SIMPLES_DAS_NOT_CONFIGURED } from './pgdasd/constants.js'
import {
  buildFallbackPeriodList,
  consultarDeclaracoesPorAno,
  mapDeclaracoesToPeriods,
  resolveDasIdsDoPeriodo,
} from './pgdasd/consultar-declaracoes.js'
import { gerarDasPgdasd } from './pgdasd/gerar-das.js'
import {
  consultarDeclaracaoReciboPgdasd,
  consultarExtratoDasPgdasd,
} from './pgdasd/consultar-extrato-das.js'
import { tryExtractDasTotalFromPdfBase64 } from '../utils/das-pdf-valor.js'
import {
  getDasSimplesById,
  getDasSimplesByPeriodo,
  listDasSimplesPeriods,
  upsertDasSimples,
} from './pgdasd/das-simples-store.js'
import {
  buildDeclaracaoMensalPayload,
  sumNfseFaturamentoPeriodo,
  transmitirDeclaracaoMensal,
} from './pgdasd/transmitir-declaracao.js'
import { recordFiscalAudit } from './fiscal-audit.service.js'
import { resolveUserEmpresaContext } from './certificate-repository.js'

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '')

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
}

/**
 * CNPJ da operação = certificado da empresa autenticada.
 * Hint do frontend só é aceito se coincidir com o CNPJ do cert / empresa.
 */
const resolveContribuinteCnpj = async (userId, cnpjHint) => {
  const fromCert = normalizeDoc(await getCertificateDocument(userId))
  const empresa = await resolveUserEmpresaContext(userId)
  const canonical = fromCert.length === 14
    ? fromCert
    : (empresa.cnpj?.length === 14 ? empresa.cnpj : '')

  if (canonical.length !== 14) {
    throw badRequest(
      'Envie o certificado A1 (e-CNPJ) da própria empresa antes de consultar o DAS Simples.',
      { code: 'CERT_REQUIRED_FOR_PGDASD' },
    )
  }

  const fromHint = normalizeDoc(cnpjHint)
  if (fromHint.length === 14 && fromHint !== canonical) {
    throw badRequest('Não é permitido consultar/emitir DAS de outro CNPJ.', {
      code: 'PGDASD_CNPJ_FORBIDDEN',
    })
  }

  if (empresa.cnpj && empresa.cnpj.length === 14 && empresa.cnpj !== canonical) {
    throw badRequest('CNPJ do certificado diverge do CNPJ da empresa cadastrada.', {
      code: 'CERT_CNPJ_MISMATCH',
    })
  }

  return canonical
}

const assertCompanyCertReady = async (userId) => {
  const hasPfx = await hasCertificatePfx(userId)
  if (!hasPfx) {
    throw badRequest(
      'Certificado A1 da empresa obrigatório para Autentica Procurador / DAS Simples.',
      { code: 'CERT_REQUIRED_FOR_PGDASD' },
    )
  }
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
  await assertCompanyCertReady(userId)
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
      if (remote.length === 0 && !refresh) {
        const prev = await consultarDeclaracoesPorAno({
          contribuinteCnpj,
          anoCalendario: year - 1,
          userId,
        })
        remote = mapDeclaracoesToPeriods(prev.dados)
      }
      await recordFiscalAudit({
        userId,
        acao: 'pgdasd_consultar_periodos',
        cnpj: contribuinteCnpj,
        detalhe: `ano=${year}; count=${remote.length}`,
      })
    } catch (err) {
      remoteError = err instanceof Error ? err.message : String(err)
      await recordFiscalAudit({
        userId,
        acao: 'pgdasd_consultar_erro',
        cnpj: contribuinteCnpj,
        detalhe: String(remoteError).slice(0, 200),
      })
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
    const prev = byPeriodo.get(periodo)
    if (!prev) {
      // Sem retorno remoto: usa só cache local de PDF (status neutro a_pagar se tiver PDF).
      byPeriodo.set(periodo, {
        competencia: row.competencia,
        periodoApuracao: periodo,
        guideId: row.id || `pgdasd-${periodo}`,
        status: row.pdf_base64 ? 'a_pagar' : (String(row.status) === 'pago' ? 'pago' : 'a_pagar'),
        errorMessage: row.error_message || null,
        valorTotal: row.valor_total ?? null,
        numeroDocumento: row.numero_documento || null,
        hasLocalPdf: Boolean(row.pdf_base64),
      })
      continue
    }
    // Status vem da Receita (CONSDECLARACAO). Local só enriquece PDF/valores.
    // guideId estável = pgdasd-AAAAMM (nunca UUID do banco — quebra o download).
    byPeriodo.set(periodo, {
      ...prev,
      guideId: `pgdasd-${periodo}`,
      valorTotal: row.valor_total ?? prev.valorTotal ?? null,
      numeroDocumento: row.numero_documento || prev.numeroDocumento || null,
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
 * Quando GERARDAS não gera PDF (mês pago / sem novo débito),
 * busca extrato do DAS (CONSEXTRATO) ou recibo da declaração (CONSDECREC).
 */
const baixarPdfExistenteDoPeriodo = async ({
  userId,
  contribuinteCnpj,
  periodo,
}) => {
  const ids = await resolveDasIdsDoPeriodo({
    contribuinteCnpj,
    periodoApuracao: periodo,
    userId,
  })

  if (ids.numeroDas) {
    const extrato = await consultarExtratoDasPgdasd({
      contribuinteCnpj,
      numeroDas: ids.numeroDas,
      userId,
    })
    const valorTotal = tryExtractDasTotalFromPdfBase64(extrato.pdfBase64)
    const saved = await upsertDasSimples({
      userId,
      cnpj: contribuinteCnpj,
      periodoApuracao: periodo,
      status: 'gerado',
      pdfBase64: extrato.pdfBase64,
      numeroDocumento: ids.numeroDas,
      valorTotal,
      detalhamento: { fonte: 'CONSEXTRATO16', numeroDas: ids.numeroDas, valorTotal },
    })
    return {
      id: saved?.id || `pgdasd-${periodo}`,
      status: 'gerado',
      competencia: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`,
      periodoApuracao: periodo,
      numeroDocumento: ids.numeroDas,
      valorTotal,
      pdfBase64: extrato.pdfBase64,
      filename: extrato.filename || `DAS-SN-extrato-${periodo}.pdf`,
      fonte: 'extrato',
    }
  }

  if (ids.numeroDeclaracao) {
    const recibo = await consultarDeclaracaoReciboPgdasd({
      contribuinteCnpj,
      numeroDeclaracao: ids.numeroDeclaracao,
      userId,
    })
    const saved = await upsertDasSimples({
      userId,
      cnpj: contribuinteCnpj,
      periodoApuracao: periodo,
      status: 'gerado',
      pdfBase64: recibo.pdfBase64,
      numeroDocumento: ids.numeroDeclaracao,
      detalhamento: { fonte: 'CONSDECREC15', numeroDeclaracao: ids.numeroDeclaracao },
    })
    return {
      id: saved?.id || `pgdasd-${periodo}`,
      status: 'gerado',
      competencia: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`,
      periodoApuracao: periodo,
      numeroDocumento: ids.numeroDeclaracao,
      valorTotal: null,
      pdfBase64: recibo.pdfBase64,
      filename: recibo.filename || `PGDASD-recibo-${periodo}.pdf`,
      fonte: 'recibo',
    }
  }

  throw badRequest(
    'Não há DAS nem declaração com PDF disponível neste período na Receita.',
    { code: 'PGDASD_SEM_DEBITO' },
  )
}

/**
 * Gera DAS e persiste PDF.
 * Se não houver valor devido (mês pago), tenta extrato/recibo automaticamente.
 */
export const gerarSimplesDas = async (userId, payload = {}) => {
  assertPgdasdSerproConfigured()
  await assertCompanyCertReady(userId)
  const contribuinteCnpj = await resolveContribuinteCnpj(userId, payload.cnpj)
  const periodo = normalizePeriodo(payload.periodoApuracao || payload.periodo)
  if (!periodo) {
    throw badRequest('Informe periodoApuracao (AAAAMM).')
  }

  // Mês já pago: vai direto ao extrato/recibo (evita MSG_E0139 do GERARDAS).
  if (payload.preferExistingPdf) {
    try {
      return await baixarPdfExistenteDoPeriodo({
        userId,
        contribuinteCnpj,
        periodo,
      })
    } catch {
      /* se falhar, tenta GERARDAS abaixo */
    }
  }

  let result
  try {
    result = await gerarDasPgdasd({
      contribuinteCnpj,
      periodoApuracao: periodo,
      dataConsolidacao: payload.dataConsolidacao || null,
      userId,
    })
  } catch (err) {
    const code = err?.errors?.code || err?.code
    const msg = String(err?.message || '')
    const isSemDebito = code === 'PGDASD_SEM_DEBITO'
      || /MSG_E0139|n[aã]o\s+haver\s+valor\s+devido|sem\s+valor\s+devido|n[aã]o\s+foi\s+gerado\s+das/i.test(msg)
    if (isSemDebito) {
      try {
        return await baixarPdfExistenteDoPeriodo({
          userId,
          contribuinteCnpj,
          periodo,
        })
      } catch (fallbackErr) {
        const fbCode = fallbackErr?.errors?.code || fallbackErr?.code
        if (fbCode === 'PGDASD_SEM_DEBITO') throw fallbackErr
        throw badRequest(
          fallbackErr?.message
            || 'Período sem novo DAS a gerar e não foi possível obter o extrato/recibo.',
          { code: 'PGDASD_SEM_DEBITO' },
        )
      }
    }
    throw err
  }

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
    fonte: 'geracao',
  }
}

/**
 * Download PDF (cache local ou regenera).
 * Aceita: AAAAMM | pgdasd-AAAAMM | UUID de das_simples.
 */
export const downloadSimplesDas = async (
  userId,
  idOrPeriodo,
  { regenerate = false, preferExistingPdf = false } = {},
) => {
  const raw = String(idOrPeriodo || '').trim()
  let periodo = null

  if (raw.startsWith('pgdasd-')) {
    periodo = normalizePeriodo(raw.slice('pgdasd-'.length))
  } else {
    periodo = normalizePeriodo(raw)
  }

  // guideId às vezes vem como UUID da linha local (não como período)
  if (!periodo && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    try {
      const byId = await getDasSimplesById({ userId, id: raw })
      periodo = normalizePeriodo(byId?.periodo_apuracao)
      if (!regenerate && byId?.pdf_base64 && periodo) {
        return {
          id: byId.id,
          status: byId.status || 'gerado',
          periodoApuracao: periodo,
          competencia: byId.competencia,
          pdfBase64: byId.pdf_base64,
          filename: `DAS-SN-${periodo}.pdf`,
          contentType: 'application/pdf',
        }
      }
    } catch {
      /* segue para erro de período */
    }
  }

  if (!periodo) {
    periodo = normalizePeriodo(raw.replace(/\D/g, '').slice(-6))
  }

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

  return gerarSimplesDas(userId, {
    periodoApuracao: periodo,
    preferExistingPdf: Boolean(preferExistingPdf),
  })
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

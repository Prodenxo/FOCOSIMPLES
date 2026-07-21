import { badRequest } from '../../utils/errors.js'
import { PGDASD_SERVICOS } from './constants.js'
import { callPgdasdServico, extractPdfBase64FromPgdasdResponse } from './client.js'

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
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
 * Gera DAS (GERARDAS12) para período já declarado no PGDAS-D.
 * @param {{ contribuinteCnpj: string, periodoApuracao: string, dataConsolidacao?: string|null, userId?: string|null }} opts
 */
export const gerarDasPgdasd = async ({
  contribuinteCnpj,
  periodoApuracao,
  dataConsolidacao = null,
  userId = null,
}) => {
  const periodo = normalizePeriodo(periodoApuracao)
  if (!periodo) {
    throw badRequest('Período de apuração inválido (use AAAAMM).')
  }

  const dados = { periodoApuracao: periodo }
  if (dataConsolidacao) {
    const dc = String(dataConsolidacao).replace(/\D/g, '')
    if (dc.length === 8) dados.dataConsolidacao = dc
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.GERARDAS,
    dados,
    modo: 'emitir',
    contribuinteCnpj,
    userId,
  })

  const pdfBase64 = extractPdfBase64FromPgdasdResponse(response)
  if (!pdfBase64) {
    const msgs = response?.raw?.mensagens || response?.dados?.mensagens || response?.mensagens
    const hint = Array.isArray(msgs)
      ? msgs.map((m) => (typeof m === 'string' ? m : m?.texto || m?.Descricao || '')).filter(Boolean).join(' ')
      : ''
    const noDebito = /MSG_E0139|n[aã]o\s+haver\s+valor\s+devido|sem\s+valor\s+devido|n[aã]o\s+foi\s+gerado\s+das/i.test(hint)
    throw badRequest(
      hint
        || 'A Receita não devolveu o PDF do DAS. Verifique se a declaração do período já foi transmitida no PGDAS-D.',
      { code: noDebito ? 'PGDASD_SEM_DEBITO' : 'PGDASD_DAS_NO_PDF' },
    )
  }

  const parsed = parseDados(response)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  const detalhe = first?.detalhamento || first?.DetalhamentoDas || first || null

  return {
    periodoApuracao: periodo,
    competencia: `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`,
    pdfBase64,
    numeroDocumento: detalhe?.numeroDocumento || null,
    valorTotal: detalhe?.valores?.total ?? null,
    dataVencimento: detalhe?.dataVencimento || null,
    detalhamento: detalhe,
    response,
  }
}

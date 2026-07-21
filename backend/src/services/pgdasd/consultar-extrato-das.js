import { badRequest } from '../../utils/errors.js'
import { PGDASD_SERVICOS } from './constants.js'
import { callPgdasdServico, extractPdfBase64FromPgdasdResponse } from './client.js'

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
 * Extrato PDF do DAS já gerado (pago ou em aberto) — CONSEXTRATO16.
 * Usado quando GERARDAS12 retorna MSG_E0139 (sem novo valor devido).
 *
 * @param {{ contribuinteCnpj: string, numeroDas: string, userId?: string|null }} opts
 */
export const consultarExtratoDasPgdasd = async ({
  contribuinteCnpj,
  numeroDas,
  userId = null,
}) => {
  const numero = String(numeroDas || '').replace(/\D/g, '')
  if (!numero || numero.length < 10) {
    throw badRequest('Número do DAS inválido para consultar extrato.', {
      code: 'PGDASD_NUMERO_DAS_INVALIDO',
    })
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.CONSEXTRATO,
    dados: { numeroDas: numero },
    modo: 'consultar',
    contribuinteCnpj,
    userId,
  })

  const pdfBase64 = extractPdfBase64FromPgdasdResponse(response)
  if (!pdfBase64) {
    const msgs = response?.raw?.mensagens || response?.dados?.mensagens || response?.mensagens
    const hint = Array.isArray(msgs)
      ? msgs.map((m) => (typeof m === 'string' ? m : m?.texto || m?.Descricao || '')).filter(Boolean).join(' ')
      : ''
    throw badRequest(
      hint || 'A Receita não devolveu o PDF do extrato deste DAS.',
      { code: 'PGDASD_EXTRATO_NO_PDF' },
    )
  }

  const parsed = parseDados(response)
  const first = Array.isArray(parsed) ? parsed[0] : parsed

  return {
    numeroDas: numero,
    pdfBase64,
    filename: first?.extrato?.nomeArquivo || `extrato-das-${numero}.pdf`,
    response,
  }
}

/**
 * PDF de declaração/recibo (CONSDECREC15) — fallback quando não houve geração de DAS.
 * @param {{ contribuinteCnpj: string, numeroDeclaracao: string, userId?: string|null }} opts
 */
export const consultarDeclaracaoReciboPgdasd = async ({
  contribuinteCnpj,
  numeroDeclaracao,
  userId = null,
}) => {
  const numero = String(numeroDeclaracao || '').replace(/\D/g, '')
  if (!numero) {
    throw badRequest('Número da declaração inválido.', {
      code: 'PGDASD_NUMERO_DECLARACAO_INVALIDO',
    })
  }

  const response = await callPgdasdServico({
    idServico: PGDASD_SERVICOS.CONSDECREC,
    dados: { numeroDeclaracao: numero },
    modo: 'consultar',
    contribuinteCnpj,
    userId,
  })

  const pdfBase64 = extractPdfBase64FromPgdasdResponse(response)
  if (!pdfBase64) {
    throw badRequest('A Receita não devolveu PDF da declaração/recibo deste período.', {
      code: 'PGDASD_DECREC_NO_PDF',
    })
  }

  const parsed = parseDados(response)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  const nome =
    first?.recibo?.nomeArquivo
    || first?.declaracao?.nomeArquivo
    || `recibo-pgdasd-${numero}.pdf`

  return {
    numeroDeclaracao: numero,
    pdfBase64,
    filename: nome,
    response,
  }
}

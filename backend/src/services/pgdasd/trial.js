import { badRequest, serviceUnavailable } from '../../utils/errors.js'
import { env } from '../../config/env.js'
import { serproApiFetch } from '../gestao/authProcurador.service.js'
import { PGDASD_SERVICOS, PGDASD_SISTEMA, PGDASD_VERSAO } from './constants.js'

export const PGDASD_TRIAL_BASE_URL =
  'https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1'
export const PGDASD_TRIAL_DECLARACAO_CNPJ = '00000000000100'
export const PGDASD_TRIAL_DECLARACAO_PA = '202101'
export const PGDASD_TRIAL_DAS_PA = '201801'
// Token publicado pela própria SERPRO nos exemplos Trial. Pode ser substituído
// por SERPRO_TRIAL_BEARER_TOKEN caso eles rotacionem a demonstração.
const SERPRO_PUBLIC_TRIAL_BEARER = '06aef429-a981-3ec5-a1f8-71d38d86481e'

const parseTrialBody = async (response) => {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    const payload = JSON.parse(text)
    if (typeof payload?.dados === 'string') {
      try {
        return { ...payload, dados: JSON.parse(payload.dados) }
      } catch {
        return payload
      }
    }
    return payload
  } catch {
    return text
  }
}

const sanitizeTrialPayload = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeTrialPayload)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (/^pdf$/i.test(key) && typeof item === 'string') {
      out[key] = `[PDF de demonstração omitido: ${item.length} caracteres]`
    } else {
      out[key] = sanitizeTrialPayload(item)
    }
  }
  return out
}

const trialRequest = async ({
  endpoint,
  idServico,
  dados,
  documento,
  deps = {},
}) => {
  const getTokens = deps.getTokens ?? (async () => ({
    accessToken: env.SERPRO_TRIAL_BEARER_TOKEN || SERPRO_PUBLIC_TRIAL_BEARER,
  }))
  const request = deps.fetch ?? serproApiFetch
  const { accessToken } = await getTokens()
  if (!accessToken) {
    throw badRequest('A SERPRO não devolveu token para o ambiente Trial.')
  }

  const body = {
    contratante: { numero: documento, tipo: 2 },
    autorPedidoDados: { numero: documento, tipo: 2 },
    contribuinte: { numero: documento, tipo: 2 },
    pedidoDados: {
      idSistema: PGDASD_SISTEMA,
      idServico,
      versaoSistema: PGDASD_VERSAO,
      dados: JSON.stringify(dados),
    },
  }

  let response
  try {
    response = await request(`${PGDASD_TRIAL_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json, text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw serviceUnavailable('Não foi possível acessar o Trial da SERPRO.', {
      code: 'PGDASD_TRIAL_UNAVAILABLE',
      originalMessage: error?.message,
    })
  }

  const payload = await parseTrialBody(response)
  if (!response.ok) {
    if (response.status === 429) {
      throw badRequest('A SERPRO limitou o Trial. Aguarde alguns segundos e tente novamente.', {
        code: 'PGDASD_TRIAL_RATE_LIMITED',
        upstreamStatus: response.status,
      })
    }
    const message = payload?.mensagens?.[0]?.texto
      || payload?.message
      || (typeof payload === 'string' ? payload : null)
      || `Trial SERPRO recusou a chamada (HTTP ${response.status}).`
    throw badRequest(message, {
      code: 'PGDASD_TRIAL_REJECTED',
      upstreamStatus: response.status,
    })
  }

  return {
    ambiente: 'trial',
    endpoint,
    idServico,
    request: body,
    response: sanitizeTrialPayload(payload),
  }
}

export const declararPgdasdTrial = async (declaracao, deps = {}) =>
  trialRequest({
    endpoint: 'Declarar',
    idServico: PGDASD_SERVICOS.TRANSDECLARACAO,
    dados: declaracao,
    documento: PGDASD_TRIAL_DECLARACAO_CNPJ,
    deps,
  })

export const gerarDasPgdasdTrial = async (deps = {}) =>
  trialRequest({
    endpoint: 'Emitir',
    idServico: PGDASD_SERVICOS.GERARDAS,
    dados: { periodoApuracao: PGDASD_TRIAL_DAS_PA },
    documento: PGDASD_TRIAL_DECLARACAO_CNPJ,
    deps,
  })

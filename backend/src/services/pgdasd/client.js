/**
 * Cliente PGDASD (Integra Contador / Simples Nacional).
 *
 * Modelo oficial (ICGERENCIADOR-019):
 * - contratante = CNPJ da plataforma (SERPRO_CONTRATANTE_*)
 * - autorPedidoDados = contribuinte = CNPJ da empresa usuária
 * - Autentica Procurador: termo XML assinado com o A1 da própria empresa
 * - OAuth/mTLS: continua com SERPRO_CERT_* (contratante), não com o A1 do cliente
 */
import { env } from '../../config/env.js'
import { badRequest } from '../../utils/errors.js'
import { emitirServico } from '../gestao/emitir.service.js'
import { consultarServico } from '../gestao/consultar.service.js'
import { PGDASD_SISTEMA, PGDASD_VERSAO, SIMPLES_DAS_NOT_CONFIGURED } from './constants.js'
import { getEmpresaAutenticaProcuradorToken } from '../serpro-authorization.service.js'
import { getPlatformSerproTokens } from '../serpro-authentication.service.js'
import { armazenarTokenNoCache } from '../gestao/authProcurador.service.js'

const isNoMtlsEnabled = () =>
  String(env.SERPRO_OAUTH_TOKEN_NO_MTLS || '').toLowerCase() === 'true'

/**
 * Valida envs SERPRO necessárias para PGDASD.
 * @throws {HttpError}
 */
export const assertPgdasdSerproConfigured = () => {
  if (!env.SERPRO_API_BASE_URL || !env.SERPRO_OAUTH_TOKEN_URL) {
    throw badRequest(SIMPLES_DAS_NOT_CONFIGURED, { code: 'PGDASD_NOT_CONFIGURED' })
  }
  if (!env.SERPRO_CONSUMER_KEY || !env.SERPRO_CONSUMER_SECRET) {
    throw badRequest('Credenciais Serpro não configuradas (CONSUMER_KEY/SECRET).', {
      code: 'PGDASD_NOT_CONFIGURED',
    })
  }
  if (!isNoMtlsEnabled() && !env.SERPRO_CERT_PFX_BASE64) {
    throw badRequest(
      'Certificado Serpro do contratante (SERPRO_CERT_PFX_BASE64) não configurado para OAuth/mTLS.',
      { code: 'PGDASD_NOT_CONFIGURED' },
    )
  }
  if (!env.SERPRO_CONTRATANTE_NUMERO) {
    throw badRequest('SERPRO_CONTRATANTE_NUMERO não configurado (CNPJ da plataforma).', {
      code: 'PGDASD_NOT_CONFIGURED',
    })
  }
}

/**
 * @returns {{ configured: boolean, missing: string[] }}
 */
export const inspectPgdasdSerproConfig = () => {
  const missing = []
  if (!env.SERPRO_API_BASE_URL) missing.push('SERPRO_API_BASE_URL')
  if (!env.SERPRO_OAUTH_TOKEN_URL) missing.push('SERPRO_OAUTH_TOKEN_URL')
  if (!env.SERPRO_CONSUMER_KEY) missing.push('SERPRO_CONSUMER_KEY')
  if (!env.SERPRO_CONSUMER_SECRET) missing.push('SERPRO_CONSUMER_SECRET')
  if (!isNoMtlsEnabled() && !env.SERPRO_CERT_PFX_BASE64) missing.push('SERPRO_CERT_PFX_BASE64')
  if (!env.SERPRO_CONTRATANTE_NUMERO) missing.push('SERPRO_CONTRATANTE_NUMERO')
  return { configured: missing.length === 0, missing }
}

/**
 * Resolve parties: plataforma = contratante; empresa = autor = contribuinte.
 * @param {string} contribuinteCnpj
 */
export const resolvePgdasdParties = (contribuinteCnpj) => {
  const contribuinte = String(contribuinteCnpj || '').replace(/\D/g, '')
  if (contribuinte.length !== 14) {
    throw badRequest('CNPJ do contribuinte inválido para PGDAS-D.')
  }
  const contratante = String(env.SERPRO_CONTRATANTE_NUMERO || '').replace(/\D/g, '')
  if (contratante.length !== 14) {
    throw badRequest('SERPRO_CONTRATANTE_NUMERO inválido.')
  }
  // Cada empresa só opera o próprio CNPJ: autor === contribuinte
  return {
    contratanteNumero: contratante,
    autorPedidoNumero: contribuinte,
    contribuinteNumero: contribuinte,
  }
}

/**
 * @param {object} opts
 */
export const callPgdasdServico = async ({
  idServico,
  dados = {},
  modo = 'emitir',
  contribuinteCnpj,
  userId = null,
}) => {
  assertPgdasdSerproConfigured()
  if (!userId) {
    throw badRequest('Usuário autenticado é obrigatório para DAS Simples (A1 da empresa).', {
      code: 'CERT_REQUIRED_FOR_PGDASD',
    })
  }

  const parties = resolvePgdasdParties(contribuinteCnpj)

  // Pré-aquece OAuth plataforma + termo Autentica Procurador com A1 da empresa
  await getPlatformSerproTokens()
  const procuradorToken = await getEmpresaAutenticaProcuradorToken(userId, {
    contribuinteCnpj: parties.contribuinteNumero,
  })
  armazenarTokenNoCache(`procurador_token_${parties.autorPedidoNumero}`, procuradorToken)

  const params = {
    ...parties,
    idSistema: PGDASD_SISTEMA,
    idServico,
    dados,
    versaoSistema: PGDASD_VERSAO,
    userId,
    contribuinteTipo: 2,
    autorTipo: 2,
  }
  if (modo === 'consultar') {
    return consultarServico(params)
  }
  return emitirServico(params)
}

/**
 * Extrai PDF base64 de respostas PGDASD / Integra Contador.
 * @param {unknown} response
 * @returns {string|null}
 */
export const extractPdfBase64FromPgdasdResponse = (response) => {
  const find = (value, depth = 0) => {
    if (!value || depth > 10) return null
    if (typeof value === 'string') {
      const t = value.trim()
      if (t.length > 80 && (/^JVBER/i.test(t) || /^%PDF/i.test(Buffer.from(t, 'base64').toString('latin1').slice(0, 5)))) {
        return t.replace(/\s/g, '')
      }
      if (/^[A-Za-z0-9+/=\r\n]+$/.test(t.slice(0, 120)) && t.length > 200) {
        try {
          const head = Buffer.from(t.replace(/\s/g, ''), 'base64').toString('latin1').slice(0, 5)
          if (head === '%PDF-') return t.replace(/\s/g, '')
        } catch {
          /* ignore */
        }
      }
      return null
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = find(item, depth + 1)
        if (found) return found
      }
      return null
    }
    if (typeof value === 'object') {
      for (const key of ['pdf', 'PDF', 'pdfBase64', 'arquivo', 'das', 'documento']) {
        const found = find(value[key], depth + 1)
        if (found) return found
      }
      for (const nested of Object.values(value)) {
        const found = find(nested, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  const dados = response?.dados
  let parsed = dados
  if (typeof dados === 'string') {
    try {
      parsed = JSON.parse(dados)
    } catch {
      parsed = dados
    }
  }
  return find(parsed) || find(response?.raw) || find(response)
}

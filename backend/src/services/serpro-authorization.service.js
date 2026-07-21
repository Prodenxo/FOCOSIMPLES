/**
 * Autentica Procurador (ICGERENCIADOR-019): termo XML assinado com A1 da empresa.
 * Contratante = plataforma (SERPRO_CONTRATANTE_*); autor = contribuinte = CNPJ da empresa.
 *
 * @see https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-contador-gerenciador/autenticaprocurador/
 */
import { badRequest } from '../utils/errors.js'
import { loadDecryptedCertificate } from './certificate-repository.js'
import { wipeBuffer } from './certificate-encryption.service.js'
import { recordFiscalAudit } from './fiscal-audit.service.js'

const tokenCache = new Map()

const getNextMidnightBrasilia = () => {
  const now = new Date()
  // Aproximação: meia-noite UTC-3
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const midnightBr = new Date(br)
  midnightBr.setUTCHours(27, 0, 0, 0) // next day 00:00 BRT as UTC+0 offset hack
  // Mais simples: Date.now() + até 24h limitado à meia-noite local do servidor
  const local = new Date()
  const next = new Date(local)
  next.setDate(local.getDate() + 1)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

/**
 * Obtém autenticar_procurador_token assinado com o A1 da empresa do userId.
 * @param {string} userId
 * @param {{ contribuinteCnpj: string, empresaId?: string|null }} opts
 */
export const getEmpresaAutenticaProcuradorToken = async (userId, opts) => {
  const contribuinteCnpj = String(opts.contribuinteCnpj || '').replace(/\D/g, '')
  if (!userId || contribuinteCnpj.length !== 14) {
    throw badRequest('Dados inválidos para Autentica Procurador da empresa')
  }

  const cacheKey = `emp_${userId}_${contribuinteCnpj}`
  const cached = tokenCache.get(cacheKey)
  if (cached?.token && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const loaded = await loadDecryptedCertificate(userId, { empresaId: opts.empresaId || null })
  if (!loaded?.pfx) {
    throw badRequest('Certificado A1 da empresa não configurado para o Autentica Procurador', {
      code: 'CERT_REQUIRED_FOR_PGDASD',
    })
  }

  if (loaded.meta?.cnpj && loaded.meta.cnpj !== contribuinteCnpj) {
    wipeBuffer(loaded.pfx)
    throw badRequest('CNPJ do certificado diverge do contribuinte da operação', {
      code: 'CERT_CNPJ_MISMATCH',
    })
  }

  // Reutiliza implementação existente (XMLDSig + POST /Apoiar) com cert do usuário em cache.
  const { obterAutenticaProcuradorTokenSerpro, __setUserCertForAuthorization } = await import(
    './mei-guide.service.js'
  )

  // Injeta cert em memória para getProcuradorContext
  if (typeof __setUserCertForAuthorization === 'function') {
    __setUserCertForAuthorization(userId, {
      pfx: loaded.pfx,
      passphrase: loaded.passphrase,
      certInfo: {
        doc: loaded.meta.cnpj,
        holderName: loaded.meta.holderName,
        validFrom: loaded.meta.validFrom,
        validTo: loaded.meta.validTo,
      },
    })
  } else {
    const meiGuide = await import('./mei-guide.service.js')
    // fallback: setUserCert se exportado
    if (meiGuide.setUserCert) {
      meiGuide.setUserCert(userId, {
        pfx: loaded.pfx,
        passphrase: loaded.passphrase,
        certInfo: { doc: loaded.meta.cnpj, holderName: loaded.meta.holderName },
      })
    }
  }

  try {
    const token = await obterAutenticaProcuradorTokenSerpro(userId, {
      contribuinteNumero: contribuinteCnpj,
      contribuinteTipo: 2,
      autorPedidoNumero: contribuinteCnpj,
      autorTipo: 2,
    })
    tokenCache.set(cacheKey, { token, expiresAt: getNextMidnightBrasilia() })
    await recordFiscalAudit({
      userId,
      empresaId: loaded.meta?.empresaId,
      acao: 'autentica_procurador_ok',
      cnpj: contribuinteCnpj,
      detalhe: 'termo assinado com A1 da empresa',
    })
    return token
  } finally {
    wipeBuffer(loaded.pfx)
  }
}

export const clearEmpresaAutenticaCache = (userId) => {
  for (const key of tokenCache.keys()) {
    if (String(key).startsWith(`emp_${userId}_`)) tokenCache.delete(key)
  }
}

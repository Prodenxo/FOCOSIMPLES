/**
 * Upload transacional de certificado A1 da empresa.
 * Resposta pública apenas — nunca PFX/senha/IV/authTag.
 */
import { badRequest } from '../utils/errors.js'
import { assertMeiCertificateEligible } from './mei-certificate-eligibility.service.js'
import {
  repackPkcs12,
  validatePkcs12Certificate,
} from './certificate-validation.service.js'
import {
  generateAppPkcs12Passphrase,
  resolveUserEmpresaContext,
  saveEncryptedCertificate,
  syncEmpresaCnpjFromCert,
} from './certificate-repository.js'
import { wipeBuffer } from './certificate-encryption.service.js'
import { recordFiscalAudit } from './fiscal-audit.service.js'
import { env } from '../config/env.js'

const clearTemps = (...bufs) => {
  for (const b of bufs) wipeBuffer(b)
}

/**
 * @param {string} userId
 * @param {{ file: { buffer: Buffer, originalname?: string }, password: string }} payload
 */
export const uploadCompanyCertificate = async (userId, payload) => {
  if (!userId) throw badRequest('Usuário não identificado')
  if (!env.MEI_CERT_ENCRYPTION_KEY && !env.CERT_ENCRYPTION_KEY) {
    throw badRequest(
      'MEI_CERT_ENCRYPTION_KEY não configurada no servidor. Sem ela o certificado não é gravado de forma segura.',
      { code: 'MEI_CERT_ENCRYPTION_KEY_MISSING' },
    )
  }

  const file = payload?.file
  const password = String(payload?.password || '')
  if (!file?.buffer) throw badRequest('Arquivo de certificado não informado')
  if (!password) throw badRequest('Senha do certificado é obrigatória')

  const empresaCtx = await resolveUserEmpresaContext(userId)
  const expectedCnpj = empresaCtx.cnpj || null

  const validation = validatePkcs12Certificate(file.buffer, password, {
    expectedCnpj,
  })

  if (!validation.valid) {
    const code = validation.errors.some((e) => /senha/i.test(e))
      ? 'MEI_CERT_INVALID_PASSWORD'
      : 'CERT_VALIDATION_FAILED'
    throw badRequest(validation.errors.join('; ') || 'Certificado inválido', { code })
  }

  await assertMeiCertificateEligible(validation.cnpj)

  if (expectedCnpj && validation.cnpj !== expectedCnpj) {
    throw badRequest(
      `CNPJ do certificado (${validation.cnpj}) diverge do CNPJ da empresa cadastrada (${expectedCnpj})`,
      { code: 'CERT_CNPJ_MISMATCH' },
    )
  }

  const appPass = generateAppPkcs12Passphrase()
  let repacked
  try {
    repacked = repackPkcs12(validation.privateKey, validation.certificate, appPass)
  } catch {
    throw badRequest('Falha ao reempacotar certificado para armazenamento seguro')
  }

  if (empresaCtx.empresaId) {
    await syncEmpresaCnpjFromCert(
      empresaCtx.empresaId,
      validation.cnpj,
      validation.holderName,
    )
  }

  const publicView = await saveEncryptedCertificate({
    userId,
    empresaId: empresaCtx.empresaId,
    pfxBuffer: repacked,
    appPassphrase: appPass,
    meta: {
      cnpj: validation.cnpj,
      holderName: validation.holderName,
      serialNumber: validation.serialNumber,
      issuer: validation.issuer,
      thumbprint: validation.thumbprint,
      validFrom: validation.validFrom?.toISOString?.() || null,
      validTo: validation.validTo?.toISOString?.() || null,
    },
  })

  await recordFiscalAudit({
    userId,
    empresaId: empresaCtx.empresaId,
    acao: 'certificate_upload',
    cnpj: validation.cnpj,
    detalhe: `thumbprint=${validation.thumbprint?.slice(0, 12) || 'n/a'}`,
  })

  clearTemps(file.buffer, repacked)
  // limpar refs forge (GC)
  validation.privateKey = null
  validation.certificate = null

  return {
    id: publicView.id,
    cnpj: publicView.cnpj,
    titular: publicView.titular,
    emissor: publicView.emissor,
    validoDe: publicView.validoDe,
    validoAte: publicView.validoAte,
    status: publicView.status || 'VALIDO',
    nearExpiry: publicView.nearExpiry,
    warnings: validation.warnings,
  }
}

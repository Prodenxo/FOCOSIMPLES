/**
 * Persistência de certificados digitais (user_mei_certificates estendido).
 * Decrypt apenas em memória; isolamento por user_id + empresa_id.
 */
import crypto from 'node:crypto'
import { createSupabaseClient } from '../config/supabase.js'
import { env } from '../config/env.js'
import { badRequest, forbidden } from '../utils/errors.js'
import {
  decryptBufferAesGcm,
  decryptUtf8Secret,
  encryptBufferAesGcm,
  encryptUtf8Secret,
  wipeBuffer,
} from './certificate-encryption.service.js'

const TABLE = 'user_mei_certificates'

const getDb = () => {
  if (String(env.AUTH_MODE || '').trim().toLowerCase() === 'local') {
    return createSupabaseClient({ useServiceRole: true })
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Persistência de certificado indisponível')
  }
  return createSupabaseClient({ useServiceRole: true })
}

const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

/**
 * Resolve empresa ativa do usuário (role_x_user_x_empresa).
 * @returns {Promise<{ empresaId: string|null, cnpj: string|null, razaoSocial: string|null }>}
 */
export const resolveUserEmpresaContext = async (userId) => {
  if (!userId) return { empresaId: null, cnpj: null, razaoSocial: null }
  const db = getDb()
  const { data: link } = await db
    .from('role_x_user_x_empresa')
    .select('empresas_id')
    .eq('user_id', userId)
    .eq('status', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const empresaId = link?.empresas_id || null
  if (!empresaId) return { empresaId: null, cnpj: null, razaoSocial: null }

  const { data: empresa } = await db
    .from('empresas')
    .select('id, cnpj, razao_social, empresa')
    .eq('id', empresaId)
    .maybeSingle()

  return {
    empresaId,
    cnpj: digitsOnly(empresa?.cnpj).length === 14 ? digitsOnly(empresa.cnpj) : null,
    razaoSocial: empresa?.razao_social || empresa?.empresa || null,
  }
}

/**
 * Garante que o usuário tem acesso à empresa.
 */
export const assertUserOwnsEmpresa = async (userId, empresaId) => {
  if (!userId || !empresaId) throw forbidden('Acesso negado ao certificado da empresa')
  const db = getDb()
  const { data } = await db
    .from('role_x_user_x_empresa')
    .select('id')
    .eq('user_id', userId)
    .eq('empresas_id', empresaId)
    .eq('status', true)
    .maybeSingle()
  if (!data?.id) {
    throw forbidden('Tentativa de acessar certificado de outro tenant', {
      code: 'CERT_TENANT_FORBIDDEN',
    })
  }
}

/**
 * @param {object} row
 */
export const toPublicCertificateView = (row) => {
  if (!row) return null
  const status = String(row.status || 'VALIDO')
  const validTo = row.cert_valid_to ? new Date(row.cert_valid_to) : null
  const daysLeft = validTo
    ? Math.ceil((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  return {
    id: row.id,
    cnpj: digitsOnly(row.cert_document),
    titular: row.razao_social_titular || row.razao_social || null,
    emissor: row.emissor || null,
    validoDe: row.cert_valid_from || null,
    validoAte: row.cert_valid_to || null,
    status,
    expiresInDays: daysLeft,
    nearExpiry: typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 30,
  }
}

/**
 * Salva certificado cifrado (substitui ativo da empresa/usuário).
 */
export const saveEncryptedCertificate = async ({
  userId,
  empresaId = null,
  pfxBuffer,
  appPassphrase,
  meta,
}) => {
  if (!userId) throw badRequest('Usuário não identificado')
  if (!Buffer.isBuffer(pfxBuffer) || !pfxBuffer.length) {
    throw badRequest('PFX inválido')
  }
  if (empresaId) await assertUserOwnsEmpresa(userId, empresaId)

  const { ciphertext, iv, authTag } = encryptBufferAesGcm(pfxBuffer)
  const { passphraseEnc, passphraseIv } = encryptUtf8Secret(appPassphrase)

  const db = getDb()

  // Marca anteriores da mesma empresa como SUBSTITUIDO
  if (empresaId) {
    await db
      .from(TABLE)
      .update({ status: 'SUBSTITUIDO', updated_at: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .eq('status', 'VALIDO')
  }

  const row = {
    user_id: userId,
    empresa_id: empresaId,
    pfx_base64: null,
    pfx_enc: ciphertext,
    pfx_iv: iv,
    pfx_auth_tag: authTag,
    passphrase_enc: passphraseEnc,
    passphrase_iv: passphraseIv,
    cert_document: meta.cnpj || null,
    cert_valid_from: meta.validFrom || null,
    cert_valid_to: meta.validTo || null,
    razao_social_titular: meta.holderName || null,
    razao_social: meta.holderName || null,
    numero_serie: meta.serialNumber || null,
    emissor: meta.issuer || null,
    thumbprint: meta.thumbprint || null,
    status: 'VALIDO',
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await db
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let saved
  if (existing?.id) {
    const { data, error } = await db
      .from(TABLE)
      .update(row)
      .eq('user_id', userId)
      .select('id, cert_document, razao_social_titular, razao_social, emissor, cert_valid_from, cert_valid_to, status, empresa_id')
      .single()
    if (error) throw badRequest(error.message || 'Falha ao atualizar certificado')
    saved = data
  } else {
    const { data, error } = await db
      .from(TABLE)
      .insert(row)
      .select('id, cert_document, razao_social_titular, razao_social, emissor, cert_valid_from, cert_valid_to, status, empresa_id')
      .single()
    if (error) throw badRequest(error.message || 'Falha ao salvar certificado')
    saved = data
  }

  wipeBuffer(pfxBuffer)
  return toPublicCertificateView(saved)
}

/**
 * Carrega PFX descriptografado + senha da app (em memória).
 * @returns {Promise<{ pfx: Buffer, passphrase: string, meta: object }|null>}
 */
export const loadDecryptedCertificate = async (userId, { empresaId = null } = {}) => {
  if (!userId) return null
  if (empresaId) await assertUserOwnsEmpresa(userId, empresaId)

  const db = getDb()
  let query = db
    .from(TABLE)
    .select(`
      id, user_id, empresa_id, pfx_base64, pfx_enc, pfx_iv, pfx_auth_tag,
      passphrase_enc, passphrase_iv, cert_document, cert_valid_from, cert_valid_to,
      razao_social_titular, numero_serie, emissor, thumbprint, status
    `)
    .eq('user_id', userId)
    .neq('status', 'REMOVIDO')

  if (empresaId) {
    query = query.eq('empresa_id', empresaId)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  if (data.status === 'SUBSTITUIDO' || data.status === 'REMOVIDO') return null

  if (!data.passphrase_enc || !data.passphrase_iv) return null
  const passphrase = decryptUtf8Secret(data.passphrase_enc, data.passphrase_iv)

  let pfx
  if (data.pfx_enc && data.pfx_iv && data.pfx_auth_tag) {
    pfx = decryptBufferAesGcm({
      ciphertext: data.pfx_enc,
      iv: data.pfx_iv,
      authTag: data.pfx_auth_tag,
    })
  } else if (data.pfx_base64) {
    pfx = Buffer.from(data.pfx_base64, 'base64')
  } else {
    return null
  }

  await db
    .from(TABLE)
    .update({ ultima_utilizacao_em: new Date().toISOString() })
    .eq('id', data.id)

  return {
    pfx,
    passphrase,
    meta: {
      id: data.id,
      empresaId: data.empresa_id,
      cnpj: digitsOnly(data.cert_document),
      holderName: data.razao_social_titular,
      serialNumber: data.numero_serie,
      issuer: data.emissor,
      thumbprint: data.thumbprint,
      validFrom: data.cert_valid_from,
      validTo: data.cert_valid_to,
      status: data.status,
    },
  }
}

export const getPublicCertificateStatus = async (userId) => {
  if (!userId) return null
  const db = getDb()
  const { data } = await db
    .from(TABLE)
    .select('id, cert_document, razao_social_titular, razao_social, emissor, cert_valid_from, cert_valid_to, status, empresa_id, thumbprint')
    .eq('user_id', userId)
    .neq('status', 'REMOVIDO')
    .maybeSingle()
  if (!data) return null
  const hasPfx = true
  // hasPfx real check via separate select would leak; status VALIDO implies stored
  return {
    ...toPublicCertificateView(data),
    hasCertificate: data.status === 'VALIDO' || data.status === 'EXPIRADO',
    empresaId: data.empresa_id,
    thumbprint: data.thumbprint,
  }
}

export const markCertificateRemoved = async (userId) => {
  if (!userId) throw badRequest('Usuário não identificado')
  const db = getDb()
  const { error } = await db
    .from(TABLE)
    .update({
      status: 'REMOVIDO',
      pfx_base64: null,
      pfx_enc: null,
      pfx_iv: null,
      pfx_auth_tag: null,
      passphrase_enc: null,
      passphrase_iv: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw badRequest(error.message || 'Falha ao remover certificado')
}

export const syncEmpresaCnpjFromCert = async (empresaId, cnpj, razaoSocial) => {
  if (!empresaId || digitsOnly(cnpj).length !== 14) return
  const db = getDb()
  const { data } = await db
    .from('empresas')
    .select('cnpj')
    .eq('id', empresaId)
    .maybeSingle()
  const current = digitsOnly(data?.cnpj)
  if (current.length === 14) return
  await db
    .from('empresas')
    .update({
      cnpj: digitsOnly(cnpj),
      ...(razaoSocial ? { razao_social: razaoSocial } : {}),
    })
    .eq('id', empresaId)
}

/** Gera senha aleatória para reempacotar PKCS#12 (não é a senha do usuário). */
export const generateAppPkcs12Passphrase = () => crypto.randomBytes(24).toString('base64url')

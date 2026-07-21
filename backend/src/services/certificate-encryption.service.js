/**
 * Criptografia autenticada de material de certificado (AES-256-GCM).
 * Chave: MEI_CERT_ENCRYPTION_KEY (32 bytes raw ou base64 44 chars).
 * Nunca logar plaintext, IV+ciphertext juntos em logs de debug com PFX.
 */
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { badRequest } from '../utils/errors.js'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const KEY_LEN = 32
const TAG_LEN = 16

export const getCertificateEncryptionKey = () => {
  const raw = env.MEI_CERT_ENCRYPTION_KEY || env.CERT_ENCRYPTION_KEY
  if (!raw) {
    throw badRequest('MEI_CERT_ENCRYPTION_KEY não configurada', {
      code: 'MEI_CERT_ENCRYPTION_KEY_MISSING',
    })
  }
  const buf = raw.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(raw)
    ? Buffer.from(raw, 'base64')
    : Buffer.from(raw, 'utf8')
  if (buf.length < KEY_LEN) {
    throw badRequest('MEI_CERT_ENCRYPTION_KEY deve ter 32 bytes (ou 44 em base64)')
  }
  return buf.subarray(0, KEY_LEN)
}

/**
 * @param {Buffer|string} plaintext
 * @returns {{ ciphertext: string, iv: string, authTag: string }}
 */
export const encryptBufferAesGcm = (plaintext) => {
  const key = getCertificateEncryptionKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8')
  const enc = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

/**
 * @param {{ ciphertext: string, iv: string, authTag: string }} payload
 * @returns {Buffer}
 */
export const decryptBufferAesGcm = ({ ciphertext, iv, authTag }) => {
  if (!ciphertext || !iv || !authTag) {
    throw badRequest('Dados cifrados do certificado incompletos')
  }
  const key = getCertificateEncryptionKey()
  const ivBuf = Buffer.from(iv, 'base64')
  const tagBuf = Buffer.from(authTag, 'base64')
  const enc = Buffer.from(ciphertext, 'base64')
  if (tagBuf.length !== TAG_LEN) {
    throw badRequest('authTag do certificado inválida')
  }
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, ivBuf)
    decipher.setAuthTag(tagBuf)
    return Buffer.concat([decipher.update(enc), decipher.final()])
  } catch {
    throw badRequest('Falha ao descriptografar certificado (chave inválida ou dados corrompidos)', {
      code: 'CERT_DECRYPT_FAILED',
    })
  }
}

/** Compat: senha/app-passphrase (mesmo formato legado passphrase_enc = ciphertext||tag). */
export const encryptUtf8Secret = (secret) => {
  const { ciphertext, iv, authTag } = encryptBufferAesGcm(Buffer.from(String(secret), 'utf8'))
  const combined = Buffer.concat([
    Buffer.from(ciphertext, 'base64'),
    Buffer.from(authTag, 'base64'),
  ])
  return {
    passphraseEnc: combined.toString('base64'),
    passphraseIv: iv,
  }
}

export const decryptUtf8Secret = (passphraseEnc, passphraseIv) => {
  const key = getCertificateEncryptionKey()
  const iv = Buffer.from(passphraseIv, 'base64')
  const combined = Buffer.from(passphraseEnc, 'base64')
  if (combined.length < TAG_LEN) {
    throw badRequest('Dados de senha inválidos')
  }
  const enc = combined.subarray(0, combined.length - TAG_LEN)
  const tag = combined.subarray(combined.length - TAG_LEN)
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    throw badRequest('Falha ao descriptografar segredo do certificado', {
      code: 'CERT_DECRYPT_FAILED',
    })
  }
}

/** Zera buffer em memória (best-effort). */
export const wipeBuffer = (buf) => {
  if (Buffer.isBuffer(buf) && buf.length) {
    buf.fill(0)
  }
}

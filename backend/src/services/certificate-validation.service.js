/**
 * Validação de certificado A1 (PKCS#12 / e-CNPJ ICP-Brasil).
 * Revogação OCSP/CRL: best-effort; indisponível → warning, não bloqueia MVP.
 */
import crypto from 'node:crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const forge = require('node-forge')

const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

const CNPJ_OID = '2.16.76.1.3.3'

const extractDocFromSan = (cert) => {
  try {
    const ext = cert.getExtension('subjectAltName')
    if (!ext?.altNames) return null
    for (const alt of ext.altNames) {
      if (alt.type === 0 && alt.value) {
        const asn1 = forge.asn1.fromDer(alt.value)
        const walk = (node) => {
          if (!node) return null
          if (node.type === forge.asn1.Type.OID) {
            const oid = forge.asn1.derToOid(node.value)
            if (oid === CNPJ_OID) return 'OID_HIT'
          }
          if (Array.isArray(node.value)) {
            for (let i = 0; i < node.value.length; i += 1) {
              const child = node.value[i]
              if (child?.type === forge.asn1.Type.OID) {
                const oid = forge.asn1.derToOid(child.value)
                if (oid === CNPJ_OID) {
                  const next = node.value[i + 1]
                  const raw = next?.value != null ? String(next.value) : ''
                  const d = digitsOnly(raw)
                  if (d.length === 14) return d
                }
              }
              const found = walk(child)
              if (found && found !== 'OID_HIT') return found
            }
          }
          return null
        }
        const found = walk(asn1)
        if (found && found !== 'OID_HIT') return found
      }
      if (alt.value) {
        const d = digitsOnly(alt.value)
        if (d.length === 14) return d
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

const extractCn = (cert) => {
  const attrs = cert?.subject?.attributes || []
  const cn = attrs.find((a) => a.name === 'commonName' || a.shortName === 'CN')
  return cn?.value ? String(cn.value) : ''
}

const extractIssuer = (cert) => {
  const attrs = cert?.issuer?.attributes || []
  const cn = attrs.find((a) => a.name === 'commonName' || a.shortName === 'CN')
  if (cn?.value) return String(cn.value)
  return attrs.map((a) => `${a.shortName || a.name}=${a.value}`).join(', ')
}

const extractHolderName = (cn) => {
  const text = String(cn || '')
  const withoutCnpj = text.replace(/:\d{14}\s*$/, '').trim()
  return withoutCnpj || text
}

const isInvalidPfxPasswordError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase()
  return (
    msg.includes('mac could not be verified')
    || msg.includes('mac verify failure')
    || msg.includes('invalid password')
    || msg.includes('password may be incorrect')
    || msg.includes('unable to decrypt')
  )
}

/**
 * @typedef {object} CertificateValidationResult
 * @property {boolean} valid
 * @property {string} cnpj
 * @property {string} holderName
 * @property {string} serialNumber
 * @property {string} issuer
 * @property {Date|null} validFrom
 * @property {Date|null} validTo
 * @property {string} thumbprint
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {Buffer|null} [pfxBuffer]
 * @property {object|null} [privateKey]
 * @property {object|null} [certificate]
 */

/**
 * Abre PKCS#12 e valida regras de negócio.
 * @param {Buffer} fileBuffer
 * @param {string} password
 * @param {{ expectedCnpj?: string|null, now?: Date }} [opts]
 * @returns {CertificateValidationResult}
 */
export const validatePkcs12Certificate = (fileBuffer, password, opts = {}) => {
  /** @type {CertificateValidationResult} */
  const result = {
    valid: false,
    cnpj: '',
    holderName: '',
    serialNumber: '',
    issuer: '',
    validFrom: null,
    validTo: null,
    thumbprint: '',
    errors: [],
    warnings: [],
    privateKey: null,
    certificate: null,
  }

  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 32) {
    result.errors.push('Arquivo não é um PKCS#12 válido')
    return result
  }
  if (!password) {
    result.errors.push('Senha do certificado é obrigatória')
    return result
  }

  let pfx
  try {
    const pfxDer = forge.util.createBuffer(fileBuffer.toString('binary'))
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password)
  } catch (error) {
    if (isInvalidPfxPasswordError(error)) {
      result.errors.push('Senha do certificado incorreta')
    } else {
      result.errors.push('Arquivo que não é um PKCS#12 válido ou está corrompido')
    }
    return result
  }

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBagsPlain = pfx.getBags({ bagType: forge.pki.oids.keyBag })
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    || keyBagsPlain[forge.pki.oids.keyBag]?.[0]
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  if (!keyBag?.key || !certBag?.cert) {
    result.errors.push('Não foi possível extrair chave/certificado do PKCS#12')
    return result
  }

  const cert = certBag.cert
  result.privateKey = keyBag.key
  result.certificate = cert

  const cn = extractCn(cert)
  const cnpjFromSan = extractDocFromSan(cert)
  const cnCnpjMatch = cn.match(/(\d{14})\s*$/)
  const cnpj = cnpjFromSan || (cnCnpjMatch ? cnCnpjMatch[1] : '') || digitsOnly(cn).slice(-14)
  result.cnpj = cnpj.length === 14 ? cnpj : ''
  result.holderName = extractHolderName(cn)
  result.serialNumber = cert.serialNumber ? String(cert.serialNumber) : ''
  result.issuer = extractIssuer(cert)

  const notBefore = cert.validity?.notBefore ? new Date(cert.validity.notBefore) : null
  const notAfter = cert.validity?.notAfter ? new Date(cert.validity.notAfter) : null
  result.validFrom = notBefore
  result.validTo = notAfter

  try {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
    result.thumbprint = crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex')
  } catch {
    result.warnings.push('Não foi possível calcular thumbprint')
  }

  const now = opts.now || new Date()
  if (!result.cnpj) {
    result.errors.push('Certificado sem CNPJ identificável (esperado e-CNPJ)')
  }
  if (result.cnpj && result.cnpj.length !== 14) {
    result.errors.push('Certificado não é do tipo e-CNPJ (CNPJ 14 dígitos)')
  }
  if (notBefore && now < notBefore) {
    result.errors.push('Certificado ainda não válido (notBefore no futuro)')
  }
  if (notAfter && now > notAfter) {
    result.errors.push('Certificado expirado')
  }

  const expected = digitsOnly(opts.expectedCnpj)
  if (expected.length === 14 && result.cnpj && result.cnpj !== expected) {
    result.errors.push(
      `CNPJ do certificado (${result.cnpj}) diverge do CNPJ da empresa cadastrada (${expected})`,
    )
  }

  // Cadeia ICP-Brasil: verificação básica de emissor conhecido (heurística, não PKI completa).
  const issuerLower = result.issuer.toLowerCase()
  if (issuerLower && !/icp.?brasil|receita|serasa|certisign|serpro|soluti|valid|serasaexperian|ac\s/i.test(issuerLower)) {
    result.warnings.push('Emissor não reconhecido automaticamente como ICP-Brasil')
  }

  result.valid = result.errors.length === 0
  return result
}

/**
 * Reempacota PKCS#12 com nova senha controlada pela aplicação.
 * @param {object} privateKey forge private key
 * @param {object} certificate forge certificate
 * @param {string} newPassword
 * @returns {Buffer}
 */
export const repackPkcs12 = (privateKey, certificate, newPassword) => {
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [certificate], newPassword, {
    algorithm: '3des',
  })
  const der = forge.asn1.toDer(p12Asn1).getBytes()
  return Buffer.from(der, 'binary')
}

export const MEI_CERT_INVALID_PASSWORD = 'MEI_CERT_INVALID_PASSWORD'

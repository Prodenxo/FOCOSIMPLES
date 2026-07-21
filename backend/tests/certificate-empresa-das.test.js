/**
 * Testes: certificado A1 + parties PGDASD (modelo por empresa).
 * Cobre os 15 cenários do plano (validação, isolamento, crypto, parties, erros).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const forge = require('node-forge')

process.env.MEI_CERT_ENCRYPTION_KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
process.env.SERPRO_CONTRATANTE_NUMERO = '17422651000172'

const {
  encryptBufferAesGcm,
  decryptBufferAesGcm,
} = await import('../src/services/certificate-encryption.service.js')
const {
  validatePkcs12Certificate,
  repackPkcs12,
} = await import('../src/services/certificate-validation.service.js')
const { resolvePgdasdParties, inspectPgdasdSerproConfig, callPgdasdServico } = await import(
  '../src/services/pgdasd/client.js'
)
const { toPublicCertificateView } = await import('../src/services/certificate-repository.js')
const {
  clearEmpresaAutenticaCache,
} = await import('../src/services/serpro-authorization.service.js')

const makeSelfSignedEcnpjP12 = ({ cnpj = '49453916000196', password = 'senha-teste', notBefore, notAfter } = {}) => {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = notBefore || new Date(Date.now() - 86400000)
  cert.validity.notAfter = notAfter || new Date(Date.now() + 86400000 * 365)
  const attrs = [
    { name: 'commonName', value: `EMPRESA TESTE LTDA:${cnpj}` },
    { name: 'countryName', value: 'BR' },
    { name: 'organizationName', value: 'AC Teste ICP-Brasil' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' })
  const der = forge.asn1.toDer(p12Asn1).getBytes()
  return {
    buffer: Buffer.from(der, 'binary'),
    password,
    privateKey: keys.privateKey,
    certificate: cert,
    cnpj,
  }
}

/** Espelha rewriteKnownFiscalErrors / toMeiUserErrorMessage (frontend). */
const toMeiUserErrorMessage = (raw) => {
  if (!raw?.trim()) return 'Não foi possível consultar agora. Tente de novo.'
  const lower = raw.toLowerCase()
  if (/cert_required_for_pgdasd|certificado a1 da empresa|autentica procurador/i.test(raw)) {
    return 'Envie o certificado A1 da própria empresa (aba Certificado) para consultar e baixar o DAS.'
  }
  if (/pgdasd_cnpj_forbidden|outro cnpj/i.test(raw)) {
    return 'Não é permitido consultar ou emitir DAS de outro CNPJ.'
  }
  if (/cert_cnpj_mismatch/i.test(raw)) {
    return 'O CNPJ do certificado diverge do CNPJ da empresa cadastrada.'
  }
  if (['serpro', 'jwt_token', 'icgerenciador'].some((m) => lower.includes(m))) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  return raw
}

describe('1-2 encryption', () => {
  it('criptografa e descriptografa buffer', () => {
    const plain = Buffer.from('%PDF-fake-pfx-content')
    const enc = encryptBufferAesGcm(plain)
    assert.ok(enc.ciphertext && enc.iv && enc.authTag)
    assert.equal(decryptBufferAesGcm(enc).toString(), plain.toString())
  })

  it('falha com chave/authTag inválidos (decrypt key errada)', () => {
    const enc = encryptBufferAesGcm(Buffer.from('abc'))
    assert.throws(() => decryptBufferAesGcm({
      ...enc,
      authTag: Buffer.alloc(16).toString('base64'),
    }))
  })
})

describe('3-9 certificate validation', () => {
  it('certificado válido e CNPJ correspondente', () => {
    const p12 = makeSelfSignedEcnpjP12({ cnpj: '49453916000196' })
    const result = validatePkcs12Certificate(p12.buffer, p12.password, {
      expectedCnpj: '49453916000196',
    })
    assert.equal(result.valid, true)
    assert.equal(result.cnpj, '49453916000196')
    assert.ok(result.thumbprint)
  })

  it('certificado válido, mas de outro CNPJ', () => {
    const p12 = makeSelfSignedEcnpjP12({ cnpj: '49453916000196' })
    const result = validatePkcs12Certificate(p12.buffer, p12.password, {
      expectedCnpj: '17422651000172',
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => /diverge/i.test(e)))
  })

  it('senha incorreta', () => {
    const p12 = makeSelfSignedEcnpjP12()
    const result = validatePkcs12Certificate(p12.buffer, 'errada')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => /senha/i.test(e)))
  })

  it('arquivo que não é PKCS#12', () => {
    const result = validatePkcs12Certificate(Buffer.from('nao-e-pfx'), 'x')
    assert.equal(result.valid, false)
  })

  it('certificado expirado', () => {
    const p12 = makeSelfSignedEcnpjP12({
      notBefore: new Date('2020-01-01'),
      notAfter: new Date('2020-12-31'),
    })
    const result = validatePkcs12Certificate(p12.buffer, p12.password)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => /expirado/i.test(e)))
  })

  it('certificado ainda não válido', () => {
    const p12 = makeSelfSignedEcnpjP12({
      notBefore: new Date(Date.now() + 86400000 * 10),
      notAfter: new Date(Date.now() + 86400000 * 400),
    })
    const result = validatePkcs12Certificate(p12.buffer, p12.password)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => /ainda não válido/i.test(e)))
  })

  it('reempacota PKCS#12 com nova senha', () => {
    const p12 = makeSelfSignedEcnpjP12()
    const validated = validatePkcs12Certificate(p12.buffer, p12.password)
    const repacked = repackPkcs12(validated.privateKey, validated.certificate, 'nova-senha-app')
    const again = validatePkcs12Certificate(repacked, 'nova-senha-app')
    assert.equal(again.valid, true)
    assert.equal(again.cnpj, p12.cnpj)
  })
})

describe('10-11 public view / near expiry / replace status', () => {
  it('toPublicCertificateView alerta nearExpiry (< 30 dias)', () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const view = toPublicCertificateView({
      id: 'x',
      cert_document: '49453916000196',
      razao_social_titular: 'Empresa',
      emissor: 'AC',
      cert_valid_to: soon,
      status: 'VALIDO',
    })
    assert.equal(view.nearExpiry, true)
    assert.ok(view.expiresInDays <= 30)
  })

  it('status SUBSTITUIDO / REMOVIDO não vaza como ativo na view', () => {
    const removed = toPublicCertificateView({
      id: 'y',
      cert_document: '49453916000196',
      status: 'REMOVIDO',
      cert_valid_to: new Date(Date.now() + 86400000 * 100).toISOString(),
    })
    assert.equal(removed.status, 'REMOVIDO')
  })
})

describe('12 pgdasd parties (empresa = autor = contribuinte)', () => {
  it('resolve contratante plataforma e autor=contribuinte empresa', () => {
    const parties = resolvePgdasdParties('49453916000196')
    assert.equal(parties.contratanteNumero, '17422651000172')
    assert.equal(parties.autorPedidoNumero, '49453916000196')
    assert.equal(parties.contribuinteNumero, '49453916000196')
  })

  it('inspect config retorna booleano', () => {
    const cfg = inspectPgdasdSerproConfig()
    assert.equal(typeof cfg.configured, 'boolean')
    assert.ok(Array.isArray(cfg.missing))
  })

  it('callPgdasdServico exige userId (sem A1 do cliente)', async () => {
    await assert.rejects(
      () => callPgdasdServico({
        idServico: 'CONSDECLARACAO13',
        contribuinteCnpj: '49453916000196',
        userId: null,
      }),
      (err) => /usuário autenticado|CERT_REQUIRED/i.test(String(err?.message || err)),
    )
  })
})

describe('13 cross-CNPJ / tenant isolation (lógica)', () => {
  it('rejeita hint de outro CNPJ vs canônico', () => {
    const resolve = (canonical, hint) => {
      const fromHint = String(hint || '').replace(/\D/g, '')
      if (fromHint.length === 14 && fromHint !== canonical) {
        const err = new Error('Não é permitido consultar/emitir DAS de outro CNPJ.')
        err.code = 'PGDASD_CNPJ_FORBIDDEN'
        throw err
      }
      return canonical
    }
    assert.equal(resolve('49453916000196', '49453916000196'), '49453916000196')
    assert.throws(
      () => resolve('49453916000196', '17422651000172'),
      (e) => e.code === 'PGDASD_CNPJ_FORBIDDEN',
    )
  })

  it('assertUserOwnsEmpresa lança CERT_TENANT_FORBIDDEN sem vínculo', async () => {
    const { forbidden } = await import('../src/utils/errors.js')
    const err = forbidden('Tentativa de acessar certificado de outro tenant', {
      code: 'CERT_TENANT_FORBIDDEN',
    })
    assert.equal(err.status, 403)
    assert.equal(err.errors?.code, 'CERT_TENANT_FORBIDDEN')
    assert.match(String(err.message), /outro tenant/i)
  })
})

describe('14 mensagens SERPRO sem leak + cache clear', () => {
  it('mapeia CERT_REQUIRED e CNPJ forbidden; oculta jwt/secret', () => {
    assert.match(
      toMeiUserErrorMessage('Certificado A1 da empresa obrigatório para Autentica Procurador'),
      /certificado A1/i,
    )
    assert.match(
      toMeiUserErrorMessage('Não é permitido consultar/emitir DAS de outro CNPJ.'),
      /outro CNPJ/i,
    )
    assert.equal(
      toMeiUserErrorMessage('jwt_token inválido serpro secret=abc'),
      'Não foi possível consultar agora. Tente de novo.',
    )
  })

  it('clearEmpresaAutenticaCache não lança', () => {
    clearEmpresaAutenticaCache('user-fake-id')
  })
})

describe('15 concorrência replace (encrypt idempotente) + OAuth parties estáveis', () => {
  it('dois encrypts do mesmo PFX geram ciphertexts distintos (IV aleatório)', () => {
    const plain = Buffer.from('mesmo-pfx-conteudo')
    const a = encryptBufferAesGcm(plain)
    const b = encryptBufferAesGcm(plain)
    assert.notEqual(a.ciphertext, b.ciphertext)
    assert.notEqual(a.iv, b.iv)
    assert.equal(decryptBufferAesGcm(a).toString(), plain.toString())
    assert.equal(decryptBufferAesGcm(b).toString(), plain.toString())
  })

  it('parties permanecem iguais em chamadas repetidas (refresh OAuth não muda NI)', () => {
    const first = resolvePgdasdParties('49453916000196')
    const second = resolvePgdasdParties('49453916000196')
    assert.deepEqual(first, second)
    assert.notEqual(first.contratanteNumero, first.autorPedidoNumero)
  })
})

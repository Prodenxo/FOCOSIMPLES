import test from 'node:test'
import assert from 'node:assert/strict'

process.env.AUTH_MODE = 'local'
process.env.APP_PRODUCT = 'focosimples'

test('normalizeMeiEmpresaPayload no focosimples exige Simples e não força MEI especial', async () => {
  const { normalizeMeiEmpresaPayload } = await import(
    '../src/services/plugnotas/plugnotas-mei-empresa-policy.js'
  )

  const payload = normalizeMeiEmpresaPayload({
    regimeTributario: 1,
    simplesNacional: true,
  })
  assert.equal(payload.regimeTributario, 1)
  assert.equal(payload.simplesNacional, true)
  assert.equal(payload.regimeTributarioEspecial, 0)

  assert.throws(
    () => normalizeMeiEmpresaPayload({ regimeTributario: 3, simplesNacional: true }),
    /Simples Nacional/,
  )
})

test('buildMeiRegimePatchPayload no focosimples envia especial 0 (Simples)', async () => {
  const { buildMeiRegimePatchPayload } = await import(
    '../src/services/plugnotas/plugnotas-mei-empresa-policy.js'
  )
  const payload = buildMeiRegimePatchPayload('12345678000199')
  assert.equal(payload.simplesNacional, true)
  assert.equal(payload.regimeTributarioEspecial, 0)
})

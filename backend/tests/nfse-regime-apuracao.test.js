import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveRegimeApuracaoTributaria } from '../src/services/nfse-codigo-nbs.js'

describe('regimeApuracaoTributaria (E0166)', () => {
  it('default 1 (número) para optante SN ME/EPP', () => {
    assert.equal(resolveRegimeApuracaoTributaria({}), 1)
    assert.equal(typeof resolveRegimeApuracaoTributaria({}), 'number')
  })

  it('aceita override explícito 1|2|3', () => {
    assert.equal(resolveRegimeApuracaoTributaria({ regimeApuracaoTributaria: '2' }), 2)
    assert.equal(resolveRegimeApuracaoTributaria({ regApTribSN: 3 }), 3)
  })

  it('valor inválido cai no default 1', () => {
    assert.equal(resolveRegimeApuracaoTributaria({ regimeApuracaoTributaria: '  ' }), 1)
    assert.equal(resolveRegimeApuracaoTributaria({ regimeApuracaoTributaria: '9' }), 1)
  })
})

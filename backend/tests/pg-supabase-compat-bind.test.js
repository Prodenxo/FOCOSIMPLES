import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { serializePgBindValue } from '../src/config/pgSupabaseCompat.js'

describe('serializePgBindValue', () => {
  it('stringifica arrays (resposta PlugNotas) para jsonb', () => {
    const raw = [{ id: 'abc', status: 'rejeitado' }]
    assert.equal(serializePgBindValue(raw), JSON.stringify(raw))
  })

  it('mantém objetos (prepareValue do pg já serializa)', () => {
    const obj = { a: 1 }
    assert.equal(serializePgBindValue(obj), obj)
  })

  it('converte undefined em null', () => {
    assert.equal(serializePgBindValue(undefined), null)
  })

  it('mantém null e primitivos', () => {
    assert.equal(serializePgBindValue(null), null)
    assert.equal(serializePgBindValue('x'), 'x')
    assert.equal(serializePgBindValue(3), 3)
  })
})

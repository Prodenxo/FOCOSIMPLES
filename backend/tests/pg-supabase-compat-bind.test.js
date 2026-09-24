import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { serializePgBindValue, toPostgrestRows } from '../src/config/pgSupabaseCompat.js'

const NUMERIC = 1700
const TEXT = 25

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

describe('toPostgrestRows', () => {
  it('converte coluna numeric em número (paridade com PostgREST)', () => {
    const rows = toPostgrestRows({
      fields: [{ name: 'valor_sugerido', dataTypeID: NUMERIC }],
      rows: [{ valor_sugerido: '1500.00' }],
    })
    assert.equal(rows[0].valor_sugerido, 1500)
  })

  it('não mexe em texto que parece número (CNPJ, código de serviço)', () => {
    const rows = toPostgrestRows({
      fields: [
        { name: 'codigo', dataTypeID: TEXT },
        { name: 'aliquota', dataTypeID: NUMERIC },
      ],
      rows: [{ codigo: '00012345000199', aliquota: '2.5' }],
    })
    assert.equal(rows[0].codigo, '00012345000199')
    assert.equal(rows[0].aliquota, 2.5)
  })

  it('preserva null e não quebra sem fields (queries mockadas em teste)', () => {
    assert.deepEqual(
      toPostgrestRows({
        fields: [{ name: 'valor', dataTypeID: NUMERIC }],
        rows: [{ valor: null }],
      }),
      [{ valor: null }],
    )
    assert.deepEqual(toPostgrestRows({ rows: [{ valor: '9.90' }] }), [{ valor: '9.90' }])
    assert.deepEqual(toPostgrestRows({ rows: [] }), [])
    assert.deepEqual(toPostgrestRows(undefined), [])
  })
})

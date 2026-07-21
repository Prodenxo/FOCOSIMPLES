import test from 'node:test'
import assert from 'node:assert/strict'
import { tryExtractDasTotalFromPdfBase64 } from '../src/utils/das-pdf-valor.js'

test('extrai Total do padrão Principal/Multa/Juros do extrato', () => {
  const raw = '%PDF-1.4\nPrincipal 328,41 Multa 0,00 Juros 0,00 Total 328,41\n%%EOF'
  const b64 = Buffer.from(raw, 'latin1').toString('base64')
  assert.equal(tryExtractDasTotalFromPdfBase64(b64), 328.41)
})

test('retorna null sem PDF válido', () => {
  assert.equal(tryExtractDasTotalFromPdfBase64('abc'), null)
  assert.equal(tryExtractDasTotalFromPdfBase64(null), null)
})

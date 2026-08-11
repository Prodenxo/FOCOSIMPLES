import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrigemFiscal } from '../../src/fiscal-engine/resolvers/origem-resolver.js';
import { ORIGEM_FISCAL_SOURCE } from '../../src/fiscal-engine/types/origem-mercadoria.js';

test('precedência: lote > XML compra > manual', () => {
  const r = resolveOrigemFiscal({
    lotOrigem: '2',
    purchaseXmlOrigem: '0',
    manualOrigem: '1',
    productDefaultOrigem: '0',
  });
  assert.equal(r.origemMercadoria, '2');
  assert.equal(r.source, ORIGEM_FISCAL_SOURCE.LOT_CONFIRMED);
  assert.equal(r.productDefaultOrigemSuggestion, '0');
});

test('product default não promove origem fiscal', () => {
  const r = resolveOrigemFiscal({
    productDefaultOrigem: '0',
  });
  assert.equal(r.origemMercadoria, 'UNKNOWN');
  assert.equal(r.isUnknown, true);
  assert.ok(r.issues.some((i) => i.code === 'ORIGIN_UNKNOWN'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFiscalContextV31 } from '../../src/fiscal-engine/context/build-fiscal-context.js';
import { ENGINE_SCHEMA_VERSION } from '../../src/fiscal-engine/constants.js';

test('buildFiscalContextV31 usa engineSchemaVersion 3.1.0', () => {
  const ctx = buildFiscalContextV31({
    emitente: { crt: 1, uf: 'RJ' },
    destinatario: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    produto: { ncm: '40111000', descricao: 'Pneu' },
    item: { itemSource: 'THIRD_PARTY', quantidade: 1, valorUnitario: 100 },
    estoque: { origemMercadoria: '0', priorStStatus: 'RETAINED' },
  });
  assert.equal(ctx.engineSchemaVersion, ENGINE_SCHEMA_VERSION);
  assert.equal(ctx.emitente.crt, 1);
  assert.equal(ctx.item.itemSource, 'THIRD_PARTY');
  assert.equal(ctx.estoque.priorStStatus, 'RETAINED');
  assert.equal(ctx.metadata.engineSchemaVersion, ENGINE_SCHEMA_VERSION);
  assert.equal(ctx.metadata.nfeTechnicalProfile.modelo, 55);
});

test('defaultOrigemMercadoria do produto não vira origem fiscal do estoque', () => {
  const ctx = buildFiscalContextV31({
    emitente: { crt: 4, uf: 'RJ' },
    destinatario: { uf: 'RJ', icmsTaxpayerStatus: 'TAXPAYER', cpfCnpj: '12345678000199', inscricaoEstadual: '123' },
    produto: { ncm: '22021000', defaultOrigemMercadoria: '0' },
    item: { itemSource: 'THIRD_PARTY', quantidade: 1, valorUnitario: 5 },
    estoque: { origemMercadoria: 'UNKNOWN', priorStStatus: 'NO_ST_EVIDENCE' },
  });
  assert.equal(ctx.produto.defaultOrigemMercadoria, '0');
  assert.equal(ctx.estoque.origemMercadoria, 'UNKNOWN');
  assert.ok(ctx.contextIssues.some((i) => i.code === 'ORIGIN_UNKNOWN'));
});

test('itemSource UNKNOWN gera issue', () => {
  const ctx = buildFiscalContextV31({
    emitente: { crt: 1, uf: 'RJ' },
    destinatario: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    produto: { ncm: '22021000' },
    item: { quantidade: 1, valorUnitario: 1 },
    estoque: { origemMercadoria: '0', priorStStatus: 'NO_ST_EVIDENCE' },
  });
  assert.ok(ctx.contextIssues.some((i) => i.code === 'ITEM_SOURCE_UNKNOWN'));
});

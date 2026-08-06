import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dedupeTaxRuleSeedEntries,
  RJ_RETAIL_ST_SEED_COUNT,
  TAX_RULES_RJ_RETAIL_ST_ENTRIES,
  TAX_RULES_RJ_UF,
} from '../src/data/tax-rules-state-rj-retail-seed.js';

test('seed RJ retail ST contém NCMs de bebidas e higiene', () => {
  const entries = dedupeTaxRuleSeedEntries(TAX_RULES_RJ_RETAIL_ST_ENTRIES);
  const ncms = new Set(entries.map((e) => e.ncm));
  assert.ok(ncms.has('22021000'));
  assert.ok(ncms.has('22030000'));
  assert.ok(ncms.has('34022000'));
  assert.ok(ncms.has('24022000'));
  assert.ok(ncms.has('40111000'));
  assert.ok(ncms.has('25232910'));
  assert.ok(ncms.has('23091000'));
  assert.ok(ncms.has('30049099'));
  assert.equal(RJ_RETAIL_ST_SEED_COUNT, entries.length);
  assert.ok(entries.length >= 80);
});

test('seed RJ cobre segmentos de varejo geral', () => {
  const entries = dedupeTaxRuleSeedEntries(TAX_RULES_RJ_RETAIL_ST_ENTRIES);
  const segments = new Set(entries.map((e) => e.segment));
  for (const seg of ['autopecas', 'construcao', 'utilidades', 'pet', 'farmacia']) {
    assert.ok(segments.has(seg), `segmento ausente: ${seg}`);
  }
});

test('seed RJ usa UF RJ', () => {
  assert.equal(TAX_RULES_RJ_UF, 'RJ');
});

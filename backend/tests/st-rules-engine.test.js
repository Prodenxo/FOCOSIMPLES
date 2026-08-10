import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStMatrixRule,
  resolveItemTaxFromStMatrix,
  sanitizeStMatrixApiResult,
  ST_MATRIX_DEFAULTS,
} from '../src/lib/st-rules-engine.js';
import {
  calculateItemsTax,
  __resetGetDbForTests,
  __resetTaxRulesSchemaCacheForTests,
  __setGetDbForTests,
} from '../src/services/tax.service.js';

test('normalizeStMatrixRule monta regra ST completa', () => {
  const rule = normalizeStMatrixRule({
    ncm: '22021000',
    has_st: true,
    cfop_st: '6403',
    cest_default: '0300100',
  });
  assert.ok(rule);
  assert.equal(rule.ncm, '22021000');
  assert.equal(rule.csosn, '500');
  assert.equal(rule.cfop_interno, ST_MATRIX_DEFAULTS.cfop_interno);
  assert.equal(rule.cest_default, '0300100');
});

test('NCM fora da matriz → 102 / 5102 estadual', () => {
  const tax = resolveItemTaxFromStMatrix({ ncm: '61091000' }, 'RJ', 'RJ', null);
  assert.equal(tax.csosn, '102');
  assert.equal(tax.cfop, '5102');
  assert.equal(tax.hasSt, false);
});

test('NCM na matriz → 500 / 5405 estadual', () => {
  const stRule = normalizeStMatrixRule({ ncm: '22021000', has_st: true });
  const tax = resolveItemTaxFromStMatrix({ ncm: '22021000' }, 'RJ', 'RJ', stRule);
  assert.equal(tax.csosn, '500');
  assert.equal(tax.cfop, '5405');
  assert.equal(tax.hasSt, true);
});

test('sanitizeStMatrixApiResult usa cest_default da matriz', () => {
  const stRule = normalizeStMatrixRule({
    ncm: '22021000',
    has_st: true,
    cest_default: '0300100',
  });
  const tax = resolveItemTaxFromStMatrix({ ncm: '22021000' }, 'RJ', 'RJ', stRule);
  const api = sanitizeStMatrixApiResult(tax, { cest: '' });
  assert.equal(api.has_st, true);
  assert.equal(api.csosn, '500');
  assert.equal(api.cest, '0300100');
});

test('calculateItemsTax ignora csosn 500 do cliente sem matriz ST', async () => {
  __resetTaxRulesSchemaCacheForTests();
  __resetGetDbForTests();
  __setGetDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }));

  const taxes = await calculateItemsTax({
    originUf: 'RJ',
    destinationUf: 'RJ',
    items: [{ ncm: '61091000', icmsCsosn: '500', cest: '0300100' }],
  });
  assert.equal(taxes[0].has_st, false);
  assert.equal(taxes[0].csosn, '102');
  assert.equal(taxes[0].cest, null);

  __resetGetDbForTests();
});

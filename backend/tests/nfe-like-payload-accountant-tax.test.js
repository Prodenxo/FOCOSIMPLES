import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccountantTaxWithMatrixTax } from '../src/lib/nfe-like-payload-accountant-tax.js';

test('mergeAccountantTaxWithMatrixTax — prioriza CFOP interestadual da matriz', () => {
  const merged = mergeAccountantTaxWithMatrixTax(
    { cfop: '5102', csosn: '102' },
    { cfop: '6108', csosn: '102', has_st: false },
  );
  assert.equal(merged.cfop, '6108');
});

test('mergeAccountantTaxWithMatrixTax — mantém CFOP do contador quando escopo coincide', () => {
  const merged = mergeAccountantTaxWithMatrixTax(
    { cfop: '6102', csosn: '102' },
    { cfop: '6108', csosn: '102', has_st: false },
  );
  assert.equal(merged.cfop, '6102');
});

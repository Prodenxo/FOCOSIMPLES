import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toDecimal,
  formatDecimal,
  proportionalAllocate,
  sumDecimals,
} from '../../src/fiscal-engine/money/decimal.js';

test('toDecimal não usa Number como canônico', () => {
  const d = toDecimal('10.005');
  assert.equal(typeof d.toString(), 'string');
  assert.equal(formatDecimal(d, 2), '10.01');
});

test('proportionalAllocate rateia ST parcial', () => {
  const allocated = proportionalAllocate('100.00', '3', '10', 2);
  assert.equal(allocated.toFixed(2), '30.00');
});

test('sumDecimals mantém Decimal', () => {
  const sum = sumDecimals(['10.10', '20.20']);
  assert.equal(sum.toFixed(2), '30.30');
});

test('nunca converte para Number no formatDecimal', () => {
  const out = formatDecimal(toDecimal('1.005'), 2);
  assert.equal(typeof out, 'string');
  assert.equal(out, '1.01');
});

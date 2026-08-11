import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDecimalFieldPolicy,
  formatFieldByPolicy,
} from '../../src/fiscal-engine/money/decimal-field-policy.js';

test('qCom e vUnCom possuem escalas distintas', () => {
  const qCom = getDecimalFieldPolicy('qCom');
  const vUnCom = getDecimalFieldPolicy('vUnCom');
  assert.ok(qCom);
  assert.ok(vUnCom);
  assert.notEqual(qCom.maxScale, vUnCom.maxScale);
});

test('formatFieldByPolicy aplica escala do campo', () => {
  assert.equal(formatFieldByPolicy('1.23456789', 'vUnCom'), '1.2345678900');
  assert.equal(formatFieldByPolicy('1.23456789', 'vProd'), '1.23');
});

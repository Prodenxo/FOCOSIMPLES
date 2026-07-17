import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMonthFromBudgetDate,
  parseMonthFromLancamentoDate
} from '../src/services/categories.service.js';

test('parseMonthFromLancamentoDate: YYYY-MM-DD e ISO', () => {
  assert.equal(parseMonthFromLancamentoDate('2026-03-15'), 3);
  assert.equal(parseMonthFromLancamentoDate('2026-07-01T12:00:00.000Z'), 7);
});

test('parseMonthFromBudgetDate: início de mês', () => {
  assert.equal(parseMonthFromBudgetDate('2026-01-01'), 1);
  assert.equal(parseMonthFromBudgetDate('2026-12-01'), 12);
});

test('parseMonthFromLancamentoDate: inválidos', () => {
  assert.equal(parseMonthFromLancamentoDate(null), null);
  assert.equal(parseMonthFromLancamentoDate(''), null);
  assert.equal(parseMonthFromLancamentoDate('foo'), null);
});

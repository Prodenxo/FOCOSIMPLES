import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTransactionStatus } from '../src/services/transactions.service.js';

test('normalizeTransactionStatus: entrada lançada vira recebido', () => {
  assert.equal(normalizeTransactionStatus('entrada', 'pago'), 'recebido');
  assert.equal(normalizeTransactionStatus('entrada', ''), 'recebido');
  assert.equal(normalizeTransactionStatus('entrada', 'a_receber'), 'a_receber');
});

test('normalizeTransactionStatus: saída vira pago', () => {
  assert.equal(normalizeTransactionStatus('saida', 'recebido'), 'pago');
  assert.equal(normalizeTransactionStatus('saida', 'a_pagar'), 'a_pagar');
});

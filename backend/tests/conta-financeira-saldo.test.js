import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeUnassignedSaldoDelta,
  formatGetSaldoMessage,
} from '../src/services/conta-financeira-saldo.js';

test('computeUnassignedSaldoDelta soma só lançamentos sem conta_id realizados', () => {
  const delta = computeUnassignedSaldoDelta([
    { conta_id: null, tipo: 'entrada', valor: 100, status: 'recebido' },
    { conta_id: 'x', tipo: 'entrada', valor: 50, status: 'recebido' },
    { conta_id: null, tipo: 'saida', valor: 30, status: 'pago' },
    { conta_id: null, tipo: 'entrada', valor: 20, status: 'pendente' },
  ]);
  assert.equal(delta, 70);
});

test('formatGetSaldoMessage detalha saldo geral por carteira', () => {
  const msg = formatGetSaldoMessage({
    totalSaldo: 1413,
    saldoSemConta: 1000,
    contas: [
      { nome: 'Bradesco', saldoAtual: 0 },
      { nome: 'Itaú', saldoAtual: 413 },
    ],
  });
  assert.match(msg, /Saldo geral R\$\s*1\.413,00/);
  assert.match(msg, /Bradesco/);
  assert.match(msg, /Itaú/);
  assert.match(msg, /Meu Financeiro \(sem carteira\)/);
});

test('formatGetSaldoMessage com filtro devolve uma carteira', () => {
  const msg = formatGetSaldoMessage(
    {
      totalSaldo: 413,
      contas: [{ nome: 'Itaú', saldoAtual: 413 }],
    },
    { filtered: true },
  );
  assert.match(msg, /Saldo Itaú: R\$\s*413,00/);
});

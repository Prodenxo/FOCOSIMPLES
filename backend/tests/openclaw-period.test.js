import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPeriodSummaryMessage,
  resolvePeriodFromText,
  summarizeTransactions,
} from '../src/services/openclaw-period.js';

const NOW = new Date('2026-09-03T15:00:00-03:00');

test('mês passado e este mês usam o calendário de Brasília', () => {
  assert.deepEqual(resolvePeriodFromText('Quanto eu gastei mes passado?', NOW), {
    from: '2026-08-01',
    to: '2026-08-31',
    label: 'mês passado',
  });
  assert.equal(resolvePeriodFromText('este mês', NOW).from, '2026-09-01');
  assert.equal(resolvePeriodFromText('este mês', NOW).to, '2026-09-30');
});

test('intervalo em português vira from/to', () => {
  const period = resolvePeriodFromText('01/08 ate 31/08', NOW);
  assert.deepEqual(period, {
    from: '2026-08-01',
    to: '2026-08-31',
    label: '01/08 a 31/08',
  });
});

test('resumo soma só o período e o tipo pedido', () => {
  const rows = [
    { data: '2026-08-10', tipo: 'saida', valor: 100 },
    { data: '2026-08-12', tipo: 'entrada', valor: 50 },
    { data: '2026-09-01', tipo: 'saida', valor: 9 },
  ];
  const spent = summarizeTransactions(rows, {
    from: '2026-08-01',
    to: '2026-08-31',
    tipo: 'saida',
  });
  assert.equal(spent.totalSaidas, 100);
  assert.equal(spent.totalEntradas, 0);
  assert.equal(spent.count, 1);
  assert.match(formatPeriodSummaryMessage(spent), /R\$\s*100,00/);
});

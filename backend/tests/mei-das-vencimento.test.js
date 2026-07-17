import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichDasPeriodWithVencimento,
  getDasVencimentoFromCompetencia,
  isDasCompetenciaVencida,
} from '../src/services/mei-das-vencimento.js';

test('getDasVencimentoFromCompetencia — competência 05/2026 vence 20/06/2026', () => {
  const venc = getDasVencimentoFromCompetencia('2026-05');
  assert.equal(venc?.iso, '2026-06-20');
  assert.equal(venc?.display, '20/06/2026');
});

test('getDasVencimentoFromCompetencia — dezembro vira janeiro do ano seguinte', () => {
  const venc = getDasVencimentoFromCompetencia('202512');
  assert.equal(venc?.iso, '2026-01-20');
  assert.equal(venc?.display, '20/01/2026');
});

test('isDasCompetenciaVencida — antes do dia 20 ainda não venceu', () => {
  assert.equal(
    isDasCompetenciaVencida('2026-05', new Date('2026-06-20T12:00:00-03:00')),
    false,
  );
  assert.equal(
    isDasCompetenciaVencida('2026-05', new Date('2026-06-19T23:00:00-03:00')),
    false,
  );
});

test('isDasCompetenciaVencida — depois do dia 20 está vencida', () => {
  assert.equal(
    isDasCompetenciaVencida('2026-05', new Date('2026-06-21T00:30:00-03:00')),
    true,
  );
});

test('enrichDasPeriodWithVencimento — só marca vencida em a_pagar', () => {
  const ref = new Date('2026-07-13T12:00:00-03:00');
  const aberto = enrichDasPeriodWithVencimento(
    { competencia: '2026-05', status: 'a_pagar' },
    ref,
  );
  assert.equal(aberto.vencida, true);
  assert.equal(aberto.vencimento, '20/06/2026');

  const pago = enrichDasPeriodWithVencimento(
    { competencia: '2026-05', status: 'pago' },
    ref,
  );
  assert.equal(pago.vencida, false);
});

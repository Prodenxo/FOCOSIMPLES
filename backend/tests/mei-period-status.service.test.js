import test from 'node:test';
import assert from 'node:assert/strict';

test('mei-period-status converte período de apuração para competência', async () => {
  const { periodoApuracaoToCompetencia } = await import('../src/services/mei-period-status.service.js');
  assert.equal(periodoApuracaoToCompetencia('202602'), '2026-02');
  assert.equal(periodoApuracaoToCompetencia('2026-02'), '2026-02');
  assert.equal(periodoApuracaoToCompetencia('2026/15'), null);
});

test('mei-period-status converte competência para período de apuração', async () => {
  const { competenciaToPeriodoApuracao } = await import('../src/services/mei-period-status.service.js');
  assert.equal(competenciaToPeriodoApuracao('2026-02'), '202602');
  assert.equal(competenciaToPeriodoApuracao('202602'), '202602');
  assert.equal(competenciaToPeriodoApuracao('abc'), null);
});

test('mei-period-status ignora consulta de pagos quando não há userId', async () => {
  const { listPaidCompetencias } = await import('../src/services/mei-period-status.service.js');
  const data = await listPaidCompetencias({
    userId: null,
    competencias: ['2026-01', '2026-02']
  });
  assert.deepEqual(data, []);
});

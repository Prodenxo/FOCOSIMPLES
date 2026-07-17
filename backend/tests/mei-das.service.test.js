import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('mei-das valida formato de competencia', async () => {
  const { normalizeCompetencia } = await import('../src/services/mei-das.service.js');
  assert.equal(normalizeCompetencia('2026-02'), '2026-02');
  assert.equal(normalizeCompetencia(undefined), null);
  assert.throws(
    () => normalizeCompetencia('2026/02'),
    /Competência inválida/
  );
});

test('mei-das rejeita status inválido no filtro admin', async () => {
  const { normalizeStatusFilter } = await import('../src/services/mei-das.service.js');
  assert.equal(normalizeStatusFilter('pendente'), 'pendente');
  assert.equal(normalizeStatusFilter('a_pagar'), 'pendente');
  assert.throws(
    () => normalizeStatusFilter('qualquer_coisa'),
    /Status inválido/
  );
});

test('mei-das agenda job mensal considera timezone America/Sao_Paulo', async () => {
  const { shouldRunMonthlyJob } = await import('../src/services/mei-das.service.js');
  const beforeWindow = new Date('2026-03-01T10:59:00.000Z'); // 07:59 BRT
  const insideWindow = new Date('2026-03-01T11:00:00.000Z'); // 08:00 BRT

  assert.equal(shouldRunMonthlyJob(beforeWindow), false);
  assert.equal(shouldRunMonthlyJob(insideWindow), true);
});

test('mei-das calcula competencia anterior no limite de janeiro', async () => {
  const { getPreviousCompetencia } = await import('../src/services/mei-das.service.js');
  const januaryRef = new Date('2026-01-15T12:00:00.000Z');
  assert.equal(getPreviousCompetencia(januaryRef), '2025-12');
});

test('buildDasPaymentStatusMessage descreve pago e pendente', async () => {
  const { buildDasPaymentStatusMessage } = await import('../src/services/mei-das.service.js');
  assert.match(
    buildDasPaymentStatusMessage({ status: 'pago', display: '03/2026' }),
    /03\/2026.*pago/i,
  );
  assert.match(
    buildDasPaymentStatusMessage({ status: 'pendente', display: '03/2026', hasPdf: true }),
    /pendente de pagamento/i,
  );
  assert.match(
    buildDasPaymentStatusMessage({ status: 'pendente', display: '03/2026', hasPdf: false }),
    /não há guia PDF/i,
  );
});

/**
 * Integração Postgres — shadow comparisons (Fase 7A hardening).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../../src/config/env.js';
import {
  persistShadowComparison,
  buildShadowIdempotencyKey,
  runFiscalV3ShadowComparison,
  __resetShadowPersistenceForTests,
  __setShadowPostgresPersistenceEnabledForTests,
  __ensureShadowComparisonSchemaForTests,
  findShadowComparisonByIdempotencyKey,
  findShadowComparisonByComparisonId,
  __deleteShadowComparisonForTests,
  SHADOW_EXECUTION_STATUS,
} from '../../src/fiscal-engine/index.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';

const hasDb = Boolean(String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim());

const buildComparison = ({
  comparisonId = randomUUID(),
  empresaId,
  correlationId,
  emissionAttemptId,
}) => ({
  comparisonId,
  empresaId,
  userId: null,
  timestamp: new Date().toISOString(),
  engineSchemaVersion: '3.1.0',
  legacyVersion: 'legacy-tax-service-v1',
  v3Version: '3.1.0',
  correlationId,
  emissionAttemptId,
  executionStatus: SHADOW_EXECUTION_STATUS.OK,
  legacySnapshots: [{ correlationKey: 'prod:1', cfop: '5102' }],
  v3Snapshots: [{ correlationKey: 'prod:1', cfop: '5102' }],
  items: [],
  summary: { exactMatches: 1, differences: 0, itemCount: 1 },
  executionIssues: [],
});

test.before(async () => {
  if (!hasDb) return;
  await __ensureShadowComparisonSchemaForTests();
});

test.beforeEach(() => {
  __resetShadowPersistenceForTests();
  __setShadowPostgresPersistenceEnabledForTests(true);
});

test('PG1. persistência Postgres da comparison', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const correlationId = `corr-${randomUUID()}`;
  const comparisonId = randomUUID();
  const comparison = buildComparison({ comparisonId, empresaId, correlationId, emissionAttemptId: correlationId });

  const result = await persistShadowComparison(comparison);
  assert.equal(result.postgres?.persisted, true);

  const row = await findShadowComparisonByComparisonId(comparisonId);
  assert.ok(row);
  assert.equal(row.execution_status, SHADOW_EXECUTION_STATUS.OK);

  await __deleteShadowComparisonForTests(comparisonId);
});

test('PG2. retry DB idempotente — mesma chave não duplica', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const correlationId = `corr-${randomUUID()}`;
  const comparison = buildComparison({ comparisonId: randomUUID(), empresaId, correlationId, emissionAttemptId: correlationId });

  const first = await persistShadowComparison(comparison);
  const second = await persistShadowComparison({
    ...comparison,
    comparisonId: randomUUID(),
  });

  assert.equal(first.postgres?.persisted, true);
  assert.equal(second.duplicate, true);

  const row = await findShadowComparisonByIdempotencyKey(empresaId, correlationId, correlationId);
  assert.ok(row);

  await __deleteShadowComparisonForTests(row.comparison_id);
});

test('PG3. restart/repository encontra comparison existente', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const correlationId = `corr-${randomUUID()}`;
  const comparisonId = randomUUID();
  const comparison = buildComparison({ comparisonId, empresaId, correlationId, emissionAttemptId: correlationId });

  await persistShadowComparison(comparison);
  __resetShadowPersistenceForTests();

  const row = await findShadowComparisonByIdempotencyKey(empresaId, correlationId, correlationId);
  assert.ok(row);
  assert.equal(row.comparison_id, comparisonId);

  await __deleteShadowComparisonForTests(comparisonId);
});

test('PG4. cross-tenant DB — mesma correlation, empresas diferentes', { skip: !hasDb }, async () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const correlationId = 'shared-correlation-key';

  const cmpA = buildComparison({
    comparisonId: randomUUID(),
    empresaId: tenantA,
    correlationId,
    emissionAttemptId: correlationId,
  });
  const cmpB = buildComparison({
    comparisonId: randomUUID(),
    empresaId: tenantB,
    correlationId,
    emissionAttemptId: correlationId,
  });

  const resA = await persistShadowComparison(cmpA);
  const resB = await persistShadowComparison(cmpB);
  assert.equal(resA.postgres?.persisted, true);
  assert.equal(resB.postgres?.persisted, true);

  const rowA = await findShadowComparisonByIdempotencyKey(tenantA, correlationId, correlationId);
  const rowB = await findShadowComparisonByIdempotencyKey(tenantB, correlationId, correlationId);
  assert.notEqual(rowA.comparison_id, rowB.comparison_id);

  await __deleteShadowComparisonForTests(rowA.comparison_id);
  await __deleteShadowComparisonForTests(rowB.comparison_id);
});

test('PG5. runFiscalV3ShadowComparison persiste via Postgres com lotes in-memory', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const prodId = 'PG-PROD-1';
  const correlationId = `emit-${randomUUID()}`;
  const payload = {
    idIntegracao: correlationId,
    emitente: { crt: 1, endereco: { estado: 'RJ' } },
    destinatario: { cpfCnpj: '12345678901', indIEDest: '9', endereco: { estado: 'RJ' } },
    itens: [{
      codigo: prodId,
      produtoCatalogoId: prodId,
      ncm: '22021000',
      cfop: '5102',
      quantidade: 2,
      valorUnitario: 5,
      valorTotal: 10,
      tributos: { icms: { csosn: '102', origem: '0' } },
    }],
  };

  const comparison = await runFiscalV3ShadowComparison({
    empresaId,
    legacyPayload: payload,
    correlationId,
    emissionAttemptId: correlationId,
    inMemoryLotsByProduct: {
      [prodId]: [buildUsableStockLot({ empresaId, produtoCatalogoId: prodId, quantidade: '5' })],
    },
  });

  assert.equal(comparison.executionStatus, SHADOW_EXECUTION_STATUS.OK);
  const row = await findShadowComparisonByIdempotencyKey(empresaId, correlationId, correlationId);
  assert.ok(row);

  await __deleteShadowComparisonForTests(row.comparison_id);
});

test('PG6. idempotency key format', () => {
  const key = buildShadowIdempotencyKey({
    empresaId: 'e1',
    correlationId: 'c1',
    emissionAttemptId: 'a1',
  });
  assert.equal(key, 'e1:c1:a1');
});

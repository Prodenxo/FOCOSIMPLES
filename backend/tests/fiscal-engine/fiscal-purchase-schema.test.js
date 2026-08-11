import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAutoEnsureFiscalPurchaseSchema,
  ensureFiscalPurchaseSchema,
  __resetFiscalPurchaseSchemaCacheForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase.schema.js';
import { env } from '../../src/config/env.js';

test.afterEach(() => {
  __resetFiscalPurchaseSchemaCacheForTests();
});

test('canAutoEnsureFiscalPurchaseSchema — produção bloqueia por padrão', () => {
  const prevNode = env.NODE_ENV;
  const prevFlag = env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE;
  env.NODE_ENV = 'production';
  env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE = '';
  assert.equal(canAutoEnsureFiscalPurchaseSchema(), false);
  env.NODE_ENV = prevNode;
  env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE = prevFlag;
});

test('canAutoEnsureFiscalPurchaseSchema — test/dev permitido', () => {
  const prevNode = env.NODE_ENV;
  env.NODE_ENV = 'test';
  assert.equal(canAutoEnsureFiscalPurchaseSchema(), true);
  env.NODE_ENV = prevNode;
});

test('ensureFiscalPurchaseSchema — rejeita em produção sem flag', async () => {
  const prevNode = env.NODE_ENV;
  const prevFlag = env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE;
  env.NODE_ENV = 'production';
  env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE = 'false';
  await assert.rejects(
    () => ensureFiscalPurchaseSchema(),
    /bloqueado em produção/i,
  );
  env.NODE_ENV = prevNode;
  env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE = prevFlag;
});

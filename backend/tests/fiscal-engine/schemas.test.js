import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFiscalIssueShape,
  validateFiscalEngineMetadataShape,
  validateFiscalRuleShape,
} from '../../src/fiscal-engine/schemas/validate-shapes.js';
import { buildFiscalEngineMetadata } from '../../src/fiscal-engine/types/nfe-technical-profile.js';

test('validateFiscalIssueShape exige campos obrigatórios', () => {
  assert.equal(validateFiscalIssueShape(null).ok, false);
  const ok = validateFiscalIssueShape({
    code: 'ORIGIN_UNKNOWN',
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
    message: 'teste',
  });
  assert.equal(ok.ok, true);
});

test('validateFiscalEngineMetadataShape separa engine e NF-e', () => {
  const meta = buildFiscalEngineMetadata({ layoutVersion: '4.00' });
  const v = validateFiscalEngineMetadataShape(meta);
  assert.equal(v.ok, true);
  assert.equal(meta.engineSchemaVersion, '3.1.0');
  assert.equal(meta.nfeTechnicalProfile.layoutVersion, '4.00');
});

test('validateFiscalRuleShape exige applicableCrt explícito', () => {
  const bad = validateFiscalRuleShape({ id: '1', ruleType: 'CFOP' });
  assert.equal(bad.ok, false);
  const good = validateFiscalRuleShape({
    id: '1',
    ruleType: 'CFOP',
    schemaVersion: '1.0',
    applicableCrt: [1],
    effectiveFrom: '2026-01-01',
    sourceLegalReference: 'test',
    productionReady: false,
  });
  assert.equal(good.ok, true);
});

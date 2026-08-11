import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOverrideFiscalResult,
  validateEmissionOverride,
  EMISSION_OVERRIDE_PERMISSION,
} from '../../src/fiscal-engine/audit/emission-override-policy.js';
import { createFiscalIssue } from '../../src/fiscal-engine/types/fiscal-issue.js';
import { createFiscalDecisionLogEntry } from '../../src/fiscal-engine/audit/fiscal-decision-log.js';

test('RULE_CONFLICT não permite override', () => {
  const issues = [createFiscalIssue('RULE_CONFLICT', 'x')];
  assert.equal(canOverrideFiscalResult(issues), false);
});

test('NEEDS_REVIEW revisável permite override', () => {
  const issues = [createFiscalIssue('ORIGIN_UNKNOWN', 'origem')];
  assert.equal(canOverrideFiscalResult(issues), true);
});

test('validateEmissionOverride exige audit trail', () => {
  const original = createFiscalDecisionLogEntry({
    issues: [createFiscalIssue('ORIGIN_UNKNOWN', 'origem')],
  });
  const finalDecision = { ...original, finalResult: { cfop: '5102' } };
  const result = validateEmissionOverride({
    originalDecision: original,
    finalDecision,
    userId: 'user-1',
    justification: 'Confirmado com contador',
    permission: EMISSION_OVERRIDE_PERMISSION,
  });
  assert.equal(result.ok, true);
  assert.ok(result.auditEntry);
  assert.equal(result.auditEntry.userId, 'user-1');
});

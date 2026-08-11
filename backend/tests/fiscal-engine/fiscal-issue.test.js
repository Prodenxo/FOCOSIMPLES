import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFiscalIssue,
  batchBlockedByIssues,
} from '../../src/fiscal-engine/types/fiscal-issue.js';

test('RULE_CONFLICT bloqueia e não permite override', () => {
  const issue = createFiscalIssue('RULE_CONFLICT', 'conflito');
  assert.equal(issue.blocksEmission, true);
  assert.equal(issue.overrideAllowed, false);
  assert.equal(issue.severity, 'ERROR');
});

test('CEST_CONFLICT bloqueia mas permite override', () => {
  const issue = createFiscalIssue('CEST_CONFLICT', 'cest divergente');
  assert.equal(issue.blocksEmission, true);
  assert.equal(issue.overrideAllowed, true);
  assert.equal(issue.severity, 'REVIEW');
});

test('batchBlockedByIssues usa blocksEmission', () => {
  assert.equal(batchBlockedByIssues([]), false);
  assert.equal(batchBlockedByIssues([
    createFiscalIssue('ORIGIN_UNKNOWN', 'origem', { severity: 'WARNING', blocksEmission: false, overrideAllowed: false }),
  ]), false);
  assert.equal(batchBlockedByIssues([
    createFiscalIssue('RULE_CONFLICT', 'x'),
  ]), true);
});

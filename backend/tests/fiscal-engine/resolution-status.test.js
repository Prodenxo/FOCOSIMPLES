import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveResolutionStatusFromIssues } from '../../src/fiscal-engine/types/resolution-status.js';
import { createFiscalIssue } from '../../src/fiscal-engine/types/fiscal-issue.js';

test('deriveResolutionStatusFromIssues prioriza ERROR bloqueante', () => {
  const status = deriveResolutionStatusFromIssues([
    createFiscalIssue('CEST_CONFLICT', 'review'),
    createFiscalIssue('RULE_CONFLICT', 'erro'),
  ]);
  assert.equal(status, 'ERROR');
});

test('NEEDS_REVIEW quando REVIEW bloqueia', () => {
  const status = deriveResolutionStatusFromIssues([
    createFiscalIssue('ORIGIN_UNKNOWN', 'origem'),
  ]);
  assert.equal(status, 'NEEDS_REVIEW');
});

test('OK sem issues bloqueantes', () => {
  assert.equal(deriveResolutionStatusFromIssues([]), 'OK');
});

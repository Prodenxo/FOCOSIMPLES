import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFiscalBatchResult } from '../../src/fiscal-engine/batch/compute-batch-blocked.js';
import { emptyFiscalNFeItem } from '../../src/fiscal-engine/types/fiscal-nfe-item.js';
import { createFiscalIssue } from '../../src/fiscal-engine/types/fiscal-issue.js';

test('batch.blocked = items.some(issue.blocksEmission)', () => {
  const okItem = emptyFiscalNFeItem({ issues: [] });
  const blockedItem = emptyFiscalNFeItem({
    issues: [createFiscalIssue('RULE_CONFLICT', 'x')],
  });

  const batchOk = buildFiscalBatchResult([okItem]);
  assert.equal(batchOk.blocked, false);

  const batchBlocked = buildFiscalBatchResult([okItem, blockedItem]);
  assert.equal(batchBlocked.blocked, true);
});

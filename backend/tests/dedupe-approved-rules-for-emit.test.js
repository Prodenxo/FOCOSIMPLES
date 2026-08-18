import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeApprovedAccountantRulesForEmit,
  buildAccountantRuleEmitScopeKey,
} from '../src/fiscal-engine/fiscal-configuration/dedupe-approved-rules-for-emit.js';

describe('dedupe-approved-rules-for-emit', () => {
  it('mantém regra APPROVED mais recente por produto/escopo', () => {
    const rules = [
      {
        id: 'old',
        status: 'APPROVED',
        establishmentId: '35774511000145',
        approvedAt: '2026-08-18T14:16:54.745Z',
        conditions: { productId: ['prod-1'], operationScope: ['INTERNAL'] },
        approvedResult: { cfop: '5667', csosn: '500' },
      },
      {
        id: 'new',
        status: 'APPROVED',
        establishmentId: '35774511000145',
        approvedAt: '2026-08-18T14:24:08.159Z',
        conditions: { productId: ['prod-1'], operationScope: ['INTERNAL'] },
        approvedResult: { cfop: '5253', csosn: '500' },
      },
      {
        id: 'draft',
        status: 'DRAFT',
        establishmentId: '35774511000145',
        conditions: { productId: ['prod-1'], operationScope: ['INTERNAL'] },
        approvedResult: { cfop: '5102', csosn: '102' },
      },
    ];

    const out = dedupeApprovedAccountantRulesForEmit(rules);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'new');
    assert.equal(out[0].approvedResult.cfop, '5253');
  });

  it('gera chave estável por establishment + product + scope', () => {
    const key = buildAccountantRuleEmitScopeKey({
      establishmentId: '35774511000145',
      conditions: { productId: ['abc'], operationScope: ['INTERNAL'] },
    });
    assert.equal(key, '35774511000145|abc|INTERNAL');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileMeiModuleConsistency } from '../src/services/users.service.js';

const empresaId = 'e1111111-1111-1111-1111-111111111111';
const linkId = 'lnk-1';

const makeAdminClient = ({
  empresaMaxMei = 0,
  staleLinks = [{ id: linkId, user_id: 'u-1', mei: true }],
  meiTrueCount = 0,
  stripeLines = []
} = {}) => {
  const updates = [];

  return {
    updates,
    from(table) {
      if (table === 'empresas') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: empresaId, max_mei: empresaMaxMei }],
              error: null
            })
          }),
          update: (payload) => {
            updates.push({ table, payload });
            return {
              eq: async () => ({ error: null })
            };
          }
        };
      }

      if (table === 'empresa_mei_subscription_lines') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({ data: stripeLines, error: null })
            })
          })
        };
      }

      if (table === 'role_x_user_x_empresa') {
        return {
          select: (columns, opts) => {
            if (opts?.count === 'exact') {
              return {
                eq: () => ({
                  eq: () => ({
                    eq: async () => ({ count: meiTrueCount, error: null })
                  })
                })
              };
            }
            return {
              eq: () => ({
                eq: () => ({
                  or: async () => ({ data: staleLinks, error: null })
                })
              })
            };
          },
          update: (payload) => {
            updates.push({ table, payload });
            return {
              in: async () => ({ error: null })
            };
          }
        };
      }

      throw new Error(`unexpected table: ${table}`);
    }
  };
};

test('reconcileMeiModuleConsistency — dry-run não persiste', async () => {
  const adminClient = makeAdminClient();
  const result = await reconcileMeiModuleConsistency(adminClient, [empresaId], {
    dryRun: true
  });

  assert.equal(result.clearedLinks, 1);
  assert.equal(result.resetEmpresas, 0);
  assert.equal(adminClient.updates.length, 0);
});

test('reconcileMeiModuleConsistency — limpa vínculo quando módulo desligado', async () => {
  const adminClient = makeAdminClient();
  const result = await reconcileMeiModuleConsistency(adminClient, [empresaId]);

  assert.equal(result.clearedLinks, 1);
  assert.deepEqual(adminClient.updates[0]?.payload, { mei: false });
});

test('reconcileMeiModuleConsistency — zera max_mei inflado sem Stripe', async () => {
  const adminClient = makeAdminClient({
    empresaMaxMei: 1,
    staleLinks: [],
    meiTrueCount: 0
  });
  const result = await reconcileMeiModuleConsistency(adminClient, [empresaId]);

  assert.equal(result.resetEmpresas, 1);
  assert.equal(adminClient.updates[0]?.payload?.max_mei, 0);
});

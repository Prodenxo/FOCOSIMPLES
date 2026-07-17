import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/utils/errors.js';
import {
  assignN8nPhoneToUser,
  pickUserIdFromN8nLinkRows,
} from '../src/services/n8n-link-phone.service.js';

test('pickUserIdFromN8nLinkRows devolve único user_id', () => {
  assert.equal(
    pickUserIdFromN8nLinkRows(
      [{ user_id: 'aa460e16-0000-4000-8000-000000000001' }],
      '558393220844',
    ),
    'aa460e16-0000-4000-8000-000000000001',
  );
});

test('pickUserIdFromN8nLinkRows ignora linhas duplicadas do mesmo user', () => {
  const id = '7428ffe0-773d-4273-b9c9-73b9e5632f14';
  assert.equal(
    pickUserIdFromN8nLinkRows(
      [{ user_id: id }, { user_id: id }],
      '5521996185328',
    ),
    id,
  );
});

test('pickUserIdFromN8nLinkRows devolve null sem linhas', () => {
  assert.equal(pickUserIdFromN8nLinkRows([], '5521975931192'), null);
  assert.equal(pickUserIdFromN8nLinkRows(null, '5521975931192'), null);
});

test('pickUserIdFromN8nLinkRows rejeita vários user_id distintos', () => {
  assert.throws(
    () =>
      pickUserIdFromN8nLinkRows(
        [
          { user_id: 'user-a' },
          { user_id: 'user-b' },
        ],
        '5521975931192',
      ),
    (err) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 400);
      assert.match(err.message, /5521975931192/);
      assert.equal(err.errors?.code, 'PHONE_AMBIGUOUS');
      return true;
    },
  );
});

test('assignN8nPhoneToUser remove o número de outras contas antes do upsert', async () => {
  const calls = [];
  const userId = 'fernando-id';
  const admin = {
    from(table) {
      assert.equal(table, 'n8n_link');
      return {
        delete() {
          return {
            eq(_col, num) {
              calls.push({ op: 'delete_eq', num });
              return {
                neq(_col2, excludedUserId) {
                  calls.push({ op: 'delete_neq', excludedUserId });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
        upsert(payload, opts) {
          calls.push({ op: 'upsert', payload, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await assignN8nPhoneToUser(admin, userId, '5521996185328');
  assert.ok(calls.some((c) => c.op === 'upsert'));
  assert.equal(calls.find((c) => c.op === 'upsert')?.payload.user_id, userId);
  assert.ok(calls.some((c) => c.op === 'delete_neq'));
});

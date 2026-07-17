import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pickPreferredUserIdFromPhoneMatches,
} from '../src/services/n8n-link-phone.service.js';

test('pickPreferredUserIdFromPhoneMatches prefere conta com empresa activa', async () => {
  const admin = {
    from(table) {
      const ctx = { table, userId: null };
      return {
        select() { return this; },
        eq(field, value) {
          if (field === 'user_id') ctx.userId = value;
          return this;
        },
        limit() { return this; },
        then(resolve) {
          if (table === 'role_x_user_x_empresa') {
            const active = ctx.userId === 'user-com-empresa';
            resolve({ data: active ? [{ status: true }] : [], error: null });
            return;
          }
          if (table === 'lancamentos_id') {
            const count = ctx.userId === 'user-com-empresa' ? 15 : 1;
            resolve({ count, error: null });
          }
        },
      };
    },
  };

  const picked = await pickPreferredUserIdFromPhoneMatches(admin, [
    'user-orfa',
    'user-com-empresa',
  ]);

  assert.equal(picked, 'user-com-empresa');
});

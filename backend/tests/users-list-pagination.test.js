import test from 'node:test';
import assert from 'node:assert/strict';

/** Espelha a estratégia de buildAuthUserMapForIds (listUsers paginado, sem teto 500). */
async function buildAuthUserMapForIdsFixture(adminClient, userIds) {
  const userMap = new Map();
  const needed = new Set(userIds.filter(Boolean));
  let page = 1;
  const perPage = 1000;

  while (needed.size > 0 && page <= 100) {
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !users?.length) break;
    for (const user of users) {
      if (!needed.has(user.id)) continue;
      userMap.set(user.id, { id: user.id, email: user.email });
      needed.delete(user.id);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return userMap;
}

test('listUsers: estratégia paginada resolve mais de 500 utilizadores', async () => {
  const allAuthUsers = Array.from({ length: 650 }, (_, index) => ({
    id: `user-${index + 1}`,
    email: `user${index + 1}@example.com`
  }));

  const adminClient = {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => {
          const start = (page - 1) * perPage;
          const users = allAuthUsers.slice(start, start + perPage);
          return { data: { users }, error: null };
        }
      }
    }
  };

  const map = await buildAuthUserMapForIdsFixture(
    adminClient,
    allAuthUsers.map((u) => u.id)
  );

  assert.equal(map.size, 650);
});

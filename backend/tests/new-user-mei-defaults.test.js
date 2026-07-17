import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key';

const makeAdminClientForCreateUser = (capturedLinks) => ({
  auth: {
    admin: {
      createUser: async () => ({
        data: {
          user: {
            id: 'new-user-1',
            email: 'novo@empresa.com',
            user_metadata: {}
          }
        },
        error: null
      })
    }
  },
  from: (table) => {
    if (table === 'empresas') {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: {
            id: 'empresa-1',
            max_mei: null,
            max_usuarios_nao_mei: null
          },
          error: null
        })
      };
    }

    if (table === 'roles') {
      return {
        select() { return this; },
        or() { return this; },
        limit() { return this; },
        maybeSingle: async () => ({
          data: {
            id: 'role-user-id',
            roles: 'user'
          },
          error: null
        })
      };
    }

    if (table === 'role_x_user_x_empresa') {
      return {
        insert: async (payload) => {
          capturedLinks.push(payload);
          return { error: null };
        }
      };
    }

    if (table === 'n8n_link') {
      return {
        upsert: async () => ({ error: null })
      };
    }

    throw new Error(`Tabela inesperada no teste: ${table}`);
  }
});

const makeAdminClientForSignup = ({ hasActiveLink, capture }) => ({
  auth: {
    signUp: async () => ({
      data: {
        user: {
          id: 'signup-user-1',
          user_metadata: {}
        }
      },
      error: null
    })
  },
  from: (table) => {
    if (table === 'profiles') {
      return {
        insert() { return this; },
        select() { return this; },
        single: async () => ({
          data: { role: 'usuario' },
          error: null
        })
      };
    }

    if (table === 'roles') {
      return {
        select() { return this; },
        or() { return this; },
        limit() { return this; },
        maybeSingle: async () => ({
          data: { id: 'role-user-id' },
          error: null
        })
      };
    }

    if (table === 'role_x_user_x_empresa') {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle: async () => ({
          data: hasActiveLink ? { id: 'active-link-1' } : null,
          error: null
        }),
        update: (payload) => {
          capture.updatedLinkPayload = payload;
          return {
            eq: async () => ({ error: null })
          };
        },
        insert: async (payload) => {
          capture.insertedLinkPayload = payload;
          return { error: null };
        }
      };
    }

    if (table === 'n8n_link') {
      return {
        upsert: async () => ({ error: null })
      };
    }

    throw new Error(`Tabela inesperada no teste: ${table}`);
  }
});

test('users.service.createUser define mei=false por padrao quando campo não é enviado', async () => {
  const usersService = await import('../src/services/users.service.js');
  const capturedLinks = [];

  const result = await usersService.createUser(
    'access-token',
    {
      email: 'novo@empresa.com',
      role: 'usuario',
      empresaId: 'empresa-1'
    },
    {
      getRequesterContextFn: async () => ({
        role: 'superadmin',
        empresaId: 'empresa-9'
      }),
      createSupabaseClientFn: () => makeAdminClientForCreateUser(capturedLinks)
    }
  );

  assert.equal(result.userId, 'new-user-1');
  assert.equal(capturedLinks.length, 1);
  assert.equal(capturedLinks[0].mei, false);
});

test('auth.service.signUp cria vínculo com mei=false quando não há vínculo ativo', async () => {
  const authService = await import('../src/services/auth.service.js');
  const capture = { insertedLinkPayload: null, updatedLinkPayload: null };

  await authService.signUp(
    {
      email: 'signup1@empresa.com',
      password: '12345678'
    },
    {
      createSupabaseClientFn: () => makeAdminClientForSignup({ hasActiveLink: false, capture })
    }
  );

  assert.ok(capture.insertedLinkPayload, 'deve inserir novo vínculo no signup');
  assert.equal(capture.insertedLinkPayload.mei, false);
  assert.equal(capture.updatedLinkPayload, null);
});

test('auth.service.signUp ajusta vínculo ativo para mei=false quando já existe', async () => {
  const authService = await import('../src/services/auth.service.js');
  const capture = { insertedLinkPayload: null, updatedLinkPayload: null };

  await authService.signUp(
    {
      email: 'signup2@empresa.com',
      password: '12345678'
    },
    {
      createSupabaseClientFn: () => makeAdminClientForSignup({ hasActiveLink: true, capture })
    }
  );

  assert.deepEqual(capture.updatedLinkPayload, { mei: false });
  assert.equal(capture.insertedLinkPayload, null);
});

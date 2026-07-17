import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setCreateSupabaseClientForInvitesTests,
  __setGetRequesterContextForInvitesTests,
  __setResolveUserIdFromAccessTokenForInvitesTests,
  acceptInvite,
  createInvite,
  hashInviteToken,
  listPendingInvites,
  revokeInvite,
  validateInviteToken
} from '../src/services/empresa-invites.service.js';
import { badRequest } from '../src/utils/errors.js';

const tearDown = () => {
  __setGetRequesterContextForInvitesTests(null);
  __setCreateSupabaseClientForInvitesTests(null);
  __setResolveUserIdFromAccessTokenForInvitesTests(null);
};

const rawInviteToken = () => 'accept-invite-token-32charsxx';

const mockAdminForAcceptInvite = ({
  inviteFetchRow,
  claimData = { id: 'inv-1', empresas_id: 'e7777777-7777-7777-7777-777777777777' },
  profileRole = 'outsider',
  profileUpsertError = null,
  activeLink = false,
  linkId = 'lnk-new'
} = {}) => {
  const defaultRow = {
    id: 'inv-1',
    empresas_id: 'e7777777-7777-7777-7777-777777777777',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    used_at: null,
    revoked_at: null
  };

  const fetchRow = inviteFetchRow !== undefined ? inviteFetchRow : defaultRow;
  const invitePayloads = [];

  const factory = () => ({
    from(table) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: profileRole }, error: null })
            })
          }),
          upsert: () => Promise.resolve({ error: profileUpsertError })
        };
      }
      if (table === 'role_x_user_x_empresa') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: activeLink ? { id: 'has-link' } : null,
                    error: null
                  })
                })
              })
            })
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: linkId }, error: null })
            })
          }),
          delete: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
      if (table === 'roles') {
        return {
          select: () => ({
            or: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { id: 'role-usuario', roles: 'usuario' },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'empresa_invites') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: fetchRow, error: null })
            })
          }),
          update: (payload) => {
            invitePayloads.push(payload);
            if (payload.used_at === null) {
              return {
                eq: async () => ({ error: null })
              };
            }
            return {
              eq: () => ({
                is: () => ({
                  is: () => ({
                    gt: () => ({
                      select: () => ({
                        maybeSingle: async () => ({
                          data: claimData,
                          error: null
                        })
                      })
                    })
                  })
                })
              })
            };
          }
        };
      }
      throw new Error(`unexpected table: ${table}`);
    }
  });

  return { factory, invitePayloads };
};

test('hashInviteToken é determinístico (SHA-256 hex)', () => {
  const h = hashInviteToken('abc-token-test');
  assert.equal(h.length, 64);
  assert.equal(hashInviteToken('abc-token-test'), h);
});

test('createInvite — admin sem empresaId retorna 403', async (t) => {
  t.afterEach(tearDown);
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u1',
    role: 'admin',
    empresaId: null,
    mei: true
  }));
  await assert.rejects(
    () => createInvite('tok', {}, { headers: {} }),
    (err) => err.status === 403
  );
});

test('createInvite — admin não pode enviar empresas_id no corpo', async (t) => {
  t.afterEach(tearDown);
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u1',
    role: 'admin',
    empresaId: 'e1111111-1111-1111-1111-111111111111',
    mei: true
  }));
  await assert.rejects(
    () => createInvite('tok', { empresas_id: 'e1111111-1111-1111-1111-111111111111' }, {}),
    (err) => err.status === 400 && /empresas_id no corpo/i.test(err.message)
  );
});

test('createInvite — admin com empresa insere convite e retorna URL absoluta', async (t) => {
  t.afterEach(tearDown);
  const empresaId = 'e2222222-2222-2222-2222-222222222222';
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u-admin',
    role: 'admin',
    empresaId,
    mei: true
  }));

  __setCreateSupabaseClientForInvitesTests(() => ({
    from(table) {
      if (table === 'empresas') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: empresaId }, error: null })
            })
          })
        };
      }
      if (table === 'empresa_invites') {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'inv-1',
                  empresas_id: empresaId,
                  expires_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  invited_email: null
                },
                error: null
              })
            })
          })
        };
      }
      return {};
    }
  }));

  const out = await createInvite('tok', {}, {
    headers: { origin: 'http://localhost:3000' }
  });
  assert.match(out.inviteUrl, /\/register\?convite=/);
  assert.ok(new URL(out.inviteUrl).searchParams.get('convite')?.length > 16);
  assert.equal(out.invite.empresas_id, empresaId);
});

test('validateInviteToken — hash desconhecido => invalid', async (t) => {
  t.afterEach(tearDown);
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    })
  }));
  const r = await validateInviteToken('x'.repeat(40));
  assert.equal(r.status, 'invalid');
});

test('validateInviteToken — convite válido', async (t) => {
  t.afterEach(tearDown);
  const raw = 'z'.repeat(32);
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'i1',
              expires_at: new Date(Date.now() + 86_400_000).toISOString(),
              used_at: null,
              revoked_at: null
            },
            error: null
          })
        })
      })
    })
  }));
  const r = await validateInviteToken(raw);
  assert.equal(r.status, 'valid');
});

test('validateInviteToken — revogado', async (t) => {
  t.afterEach(tearDown);
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'i1',
              expires_at: new Date(Date.now() + 86_400_000).toISOString(),
              used_at: null,
              revoked_at: new Date().toISOString()
            },
            error: null
          })
        })
      })
    })
  }));
  const r = await validateInviteToken('y'.repeat(32));
  assert.equal(r.status, 'revoked');
});

test('validateInviteToken — expirado', async (t) => {
  t.afterEach(tearDown);
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'i1',
              expires_at: new Date(Date.now() - 86_400_000).toISOString(),
              used_at: null,
              revoked_at: null
            },
            error: null
          })
        })
      })
    })
  }));
  const r = await validateInviteToken('e'.repeat(32));
  assert.equal(r.status, 'expired');
});

test('revokeInvite — sucesso (admin da mesma empresa)', async (t) => {
  t.afterEach(tearDown);
  const empresaId = 'e5555555-5555-5555-5555-555555555555';
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u1',
    role: 'admin',
    empresaId,
    mei: true
  }));
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'inv-ok',
              empresas_id: empresaId,
              used_at: null,
              revoked_at: null
            },
            error: null
          })
        })
      }),
      update: () => ({
        eq: async () => ({ error: null })
      })
    })
  }));
  const r = await revokeInvite('tok', 'inv-ok');
  assert.equal(r.id, 'inv-ok');
  assert.ok(r.revoked_at && typeof r.revoked_at === 'string');
});

test('revokeInvite — já usado retorna 400', async (t) => {
  t.afterEach(tearDown);
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u1',
    role: 'admin',
    empresaId: 'e3333333-3333-3333-3333-333333333333',
    mei: true
  }));
  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'inv-x',
              empresas_id: 'e3333333-3333-3333-3333-333333333333',
              used_at: new Date().toISOString(),
              revoked_at: null
            },
            error: null
          })
        })
      })
    })
  }));
  await assert.rejects(
    () => revokeInvite('tok', 'inv-x'),
    (err) => err.status === 400 && /já utilizado/i.test(err.message)
  );
});

test('listPendingInvites — admin filtra pela empresa', async (t) => {
  t.afterEach(tearDown);
  const empresaId = 'e4444444-4444-4444-4444-444444444444';
  let sawEqEmpresa = false;
  __setGetRequesterContextForInvitesTests(async () => ({
    userId: 'u1',
    role: 'admin',
    empresaId,
    mei: true
  }));

  const result = { data: [{ id: '1', empresas_id: empresaId }], error: null };
  const makeThenable = () => ({
    select: () => makeThenable(),
    is: () => makeThenable(),
    gt: () => makeThenable(),
    order: () => makeThenable(),
    eq: (col, val) => {
      if (col === 'empresas_id' && val === empresaId) sawEqEmpresa = true;
      return makeThenable();
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    }
  });

  __setCreateSupabaseClientForInvitesTests(() => ({
    from: () => makeThenable()
  }));

  const out = await listPendingInvites('tok', {});
  assert.equal(sawEqEmpresa, true);
  assert.equal(out.invites.length, 1);
});

test('acceptInvite — happy path (vínculo usuario + convite consumido)', async (t) => {
  t.afterEach(tearDown);
  const { factory, invitePayloads } = mockAdminForAcceptInvite();
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  const raw = rawInviteToken();
  const out = await acceptInvite('jwt', raw, {
    ensureEmpresaCapacity: async () => {}
  });

  assert.equal(out.empresaId, 'e7777777-7777-7777-7777-777777777777');
  assert.equal(out.inviteId, 'inv-1');
  assert.equal(out.linkId, 'lnk-new');
  assert.ok(invitePayloads[0]?.used_at);
  assert.equal(invitePayloads[1], undefined);
});

test('acceptInvite — convite expirado', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({
    inviteFetchRow: {
      id: 'inv-1',
      empresas_id: 'e7777777-7777-7777-7777-777777777777',
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      used_at: null,
      revoked_at: null
    }
  });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) => err.status === 400 && /expirado/i.test(err.message)
  );
});

test('acceptInvite — convite revogado', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({
    inviteFetchRow: {
      id: 'inv-1',
      empresas_id: 'e7777777-7777-7777-7777-777777777777',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      used_at: null,
      revoked_at: new Date().toISOString()
    }
  });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) => err.status === 400 && /revogado/i.test(err.message)
  );
});

test('acceptInvite — convite já utilizado', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({
    inviteFetchRow: {
      id: 'inv-1',
      empresas_id: 'e7777777-7777-7777-7777-777777777777',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      used_at: new Date().toISOString(),
      revoked_at: null
    }
  });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) => err.status === 400 && /já utilizado/i.test(err.message)
  );
});

test('acceptInvite — corrida: claim condicional não atualiza linha', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({ claimData: null });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) =>
      err.status === 400
      && /indisponível|já utilizado/i.test(err.message)
  );
});

test('acceptInvite — usuário já vinculado', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({ activeLink: true });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-existing');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) => err.status === 400 && /já está vinculada/i.test(err.message)
  );
});

test('acceptInvite — perfil admin bloqueado', async (t) => {
  t.afterEach(tearDown);
  const { factory } = mockAdminForAcceptInvite({ profileRole: 'admin' });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-adm');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), { ensureEmpresaCapacity: async () => {} }),
    (err) => err.status === 403
  );
});

test('acceptInvite — limite de capacidade reverte used_at', async (t) => {
  t.afterEach(tearDown);
  const { factory, invitePayloads } = mockAdminForAcceptInvite();
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), {
        ensureEmpresaCapacity: async () => {
          throw badRequest('Limite de MEI atingido para esta empresa');
        }
      }),
    (err) => err.status === 400 && /Limite de MEI/i.test(err.message)
  );

  assert.ok(invitePayloads[0]?.used_at);
  assert.equal(invitePayloads[1]?.used_at, null);
});

test('acceptInvite — falha em profiles upsert reverte vínculo e used_at', async (t) => {
  t.afterEach(tearDown);
  const { factory, invitePayloads } = mockAdminForAcceptInvite({
    profileUpsertError: { message: 'perfil indisponível' }
  });
  __setResolveUserIdFromAccessTokenForInvitesTests(async () => 'u-new-invite');
  __setCreateSupabaseClientForInvitesTests(() => factory());

  await assert.rejects(
    () =>
      acceptInvite('jwt', rawInviteToken(), {
        ensureEmpresaCapacity: async () => {}
      }),
    (err) => err.status === 400 && /perfil indisponível/i.test(err.message)
  );

  assert.ok(invitePayloads[0]?.used_at);
  assert.equal(invitePayloads[1]?.used_at, null);
});

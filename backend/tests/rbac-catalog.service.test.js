import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listRolesCatalog,
  getPermissionsForRole,
  resolvePrimaryRoleFromActorContext,
  resolveEffectivePermissionsForActor,
  checkActorPermission,
} from '../src/services/rbac-catalog.service.js';

test('listRolesCatalog inclui superadmin, admin, usuario, outsider', () => {
  const roles = listRolesCatalog().map((r) => r.id);
  assert.deepEqual(roles, ['superadmin', 'admin', 'usuario', 'outsider']);
  for (const row of listRolesCatalog()) {
    assert.ok(row.permissions.length > 0);
    assert.ok(row.summary);
  }
});

test('getPermissionsForRole normaliza user → usuario', () => {
  const r = getPermissionsForRole('user');
  assert.equal(r.role, 'usuario');
});

test('getPermissionsForRole rejeita cargo inválido', () => {
  assert.throws(() => getPermissionsForRole('ceo'), (e) => e.status === 400);
});

test('resolvePrimaryRoleFromActorContext prioriza superadmin', () => {
  assert.equal(
    resolvePrimaryRoleFromActorContext({
      profileRole: 'usuario',
      hasSuperadminCapability: true,
      memberships: [{ role: 'admin' }],
    }),
    'superadmin',
  );
});

test('checkActorPermission admin permite das colaborador mesma empresa', () => {
  const r = checkActorPermission(
    { profileRole: 'admin', memberships: [{ role: 'admin' }], hasActiveMembership: true },
    'bot.das_colaborador_same_company',
  );
  assert.equal(r.allowed, true);
});

test('checkActorPermission usuario nega gestão global', () => {
  const r = checkActorPermission(
    { profileRole: 'usuario', memberships: [{ role: 'usuario' }], hasActiveMembership: true },
    'admin_panel.full',
  );
  assert.equal(r.allowed, false);
});

test('resolveEffectivePermissionsForActor funde permissões de vários vínculos', () => {
  const eff = resolveEffectivePermissionsForActor({
    profileRole: 'usuario',
    memberships: [{ role: 'admin' }],
    hasActiveMembership: true,
  });
  assert.equal(eff.primaryRole, 'admin');
  const keys = eff.permissions.map((p) => p.key);
  assert.ok(keys.includes('bot.own_transactions'));
  assert.ok(keys.includes('app.manage_own_company'));
});

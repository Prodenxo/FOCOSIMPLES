import test from 'node:test';
import assert from 'node:assert/strict';
import authRoutes from '../src/routes/auth.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import * as controller from '../src/controllers/auth.controller.js';

const findRoute = (method, pathSuffix) => {
  const layer = authRoutes.stack.find(
    (l) =>
      l.route?.path === pathSuffix
      && l.route.methods[method.toLowerCase()],
  );
  return layer?.route;
};

test('rotas RBAC em /auth exigem requireAuth', () => {
  for (const path of ['/roles', '/permissions', '/permissions/check']) {
    const route = findRoute('get', path);
    assert.ok(route, `GET ${path} deve existir`);
    const handlers = route.stack.map((s) => s.handle);
    assert.equal(handlers.includes(requireAuth), true);
    assert.equal(
      handlers.includes(controller.listRolesCatalog)
        || handlers.includes(controller.getPermissions)
        || handlers.includes(controller.checkPermission),
      true,
    );
  }
});

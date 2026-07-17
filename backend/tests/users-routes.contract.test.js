import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/users.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import * as controller from '../src/controllers/users.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} nao encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('rotas de empresa e sync-phone usam requireAuth e controller correto', () => {
  const expectedProtectedRoutes = [
    { method: 'get', path: '/empresas/current', handler: controller.getEmpresa },
    { method: 'get', path: '/empresas/:empresaId', handler: controller.getEmpresaById },
    { method: 'post', path: '/sync-phone', handler: controller.syncPhone },
    { method: 'post', path: '/:userId/send-password-reset-email', handler: controller.sendUserPasswordResetEmail }
  ];

  for (const route of expectedProtectedRoutes) {
    const handlers = getRouteHandlers(route.path, route.method);
    assert.equal(
      handlers.includes(requireAuth),
      true,
      `${route.method.toUpperCase()} ${route.path} deve exigir autenticacao`
    );
    assert.equal(
      handlers.includes(route.handler),
      true,
      `${route.method.toUpperCase()} ${route.path} deve usar o controller esperado`
    );
  }
});

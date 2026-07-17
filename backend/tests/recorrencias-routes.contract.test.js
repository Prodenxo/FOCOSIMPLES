import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/recorrencias.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import * as controller from '../src/controllers/recorrencias.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} nao encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('rotas de recorrências existem e usam requireAuth e controller correto', () => {
  const routes = [
    { method: 'get', path: '/', handler: controller.listRecorrencias },
    { method: 'post', path: '/', handler: controller.createRecorrencia },
    { method: 'put', path: '/:id', handler: controller.updateRecorrencia },
    { method: 'delete', path: '/:id', handler: controller.deleteRecorrencia }
  ];

  for (const route of routes) {
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

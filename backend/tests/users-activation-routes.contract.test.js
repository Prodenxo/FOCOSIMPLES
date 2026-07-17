import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/users.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import * as activationController from '../src/controllers/activation.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} nao encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('GET /me/activation exige auth e controller de ativacao', () => {
  const handlers = getRouteHandlers('/me/activation', 'get');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(activationController.getActivation), true);
});

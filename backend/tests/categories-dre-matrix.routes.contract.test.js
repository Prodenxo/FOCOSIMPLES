import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/categories.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import * as controller from '../src/controllers/categories.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} nao encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('GET /budgets/dre-matrix existe, exige auth e usa listCategoryBudgetsDreMatrix', () => {
  const handlers = getRouteHandlers('/budgets/dre-matrix', 'get');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(controller.listCategoryBudgetsDreMatrix), true);
});

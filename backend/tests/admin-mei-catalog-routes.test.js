import test from 'node:test';
import assert from 'node:assert/strict';

import adminRouter from '../src/routes/admin.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { requireAdmin } from '../src/middlewares/requireAdmin.js';
import * as adminController from '../src/controllers/admin.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = adminRouter.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} não encontrada no admin router`);
  return layer.route.stack.map((item) => item.handle);
};

test('rota admin GET mei-catalogo/clientes exige requireAuth, requireAdmin e handler correto', () => {
  const handlers = getRouteHandlers('/users/:userId/mei-catalogo/clientes', 'get');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireAdmin), true);
  assert.equal(handlers.includes(adminController.listAdminUserMeiCatalogoClientes), true);
});

test('rota admin POST mei-catalogo/clientes exige requireAuth, requireAdmin e handler correto', () => {
  const handlers = getRouteHandlers('/users/:userId/mei-catalogo/clientes', 'post');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireAdmin), true);
  assert.equal(handlers.includes(adminController.createAdminUserMeiCatalogoCliente), true);
});

test('rota admin PATCH mei-catalogo/clientes/:id exige requireAuth, requireAdmin e handler correto', () => {
  const handlers = getRouteHandlers('/users/:userId/mei-catalogo/clientes/:id', 'patch');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireAdmin), true);
  assert.equal(handlers.includes(adminController.updateAdminUserMeiCatalogoCliente), true);
});

test('rota admin DELETE mei-catalogo/clientes/:id exige requireAuth, requireAdmin e handler correto', () => {
  const handlers = getRouteHandlers('/users/:userId/mei-catalogo/clientes/:id', 'delete');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireAdmin), true);
  assert.equal(handlers.includes(adminController.deleteAdminUserMeiCatalogoCliente), true);
});

test('rota admin GET mei-catalogo/produtos exige requireAuth, requireAdmin e handler correto', () => {
  const handlers = getRouteHandlers('/users/:userId/mei-catalogo/produtos', 'get');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireAdmin), true);
  assert.equal(handlers.includes(adminController.listAdminUserMeiCatalogoProdutos), true);
});

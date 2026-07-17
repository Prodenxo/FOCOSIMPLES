import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/mei-notas.routes.js';
import indexRouter from '../src/routes/index.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { requireMeiEnabled } from '../src/middlewares/requireMei.js';
import * as controller from '../src/controllers/mei-notas.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} não encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('rotas autenticadas de mei-notas exigem requireMeiEnabled', () => {
  const protectedRoutes = [
    { method: 'post', path: '/emitir' },
    { method: 'post', path: '/setup/emissao-fiscal/certificado' },
    { method: 'post', path: '/setup/emissao-fiscal/emitente' },
    { method: 'post', path: '/setup/emissao-fiscal/empresa' },
    { method: 'get', path: '/setup/emissao-fiscal/empresa' },
    { method: 'patch', path: '/setup/emissao-fiscal/empresa' },
    { method: 'post', path: '/setup/plugnotas/certificado' },
    { method: 'post', path: '/setup/plugnotas/emitente' },
    { method: 'post', path: '/setup/plugnotas/empresa' },
    { method: 'get', path: '/setup/plugnotas/empresa' },
    { method: 'patch', path: '/setup/plugnotas/empresa' },
    { method: 'get', path: '/' },
    { method: 'get', path: '/limite-faturamento' },
    { method: 'get', path: '/relatorio/nfe' },
    { method: 'get', path: '/catalogo/clientes' },
    { method: 'post', path: '/catalogo/clientes' },
    { method: 'patch', path: '/catalogo/clientes/:id' },
    { method: 'delete', path: '/catalogo/clientes/:id' },
    { method: 'get', path: '/catalogo/produtos' },
    { method: 'get', path: '/catalogo/codigos-servicos' },
    { method: 'post', path: '/catalogo/produtos' },
    { method: 'patch', path: '/catalogo/produtos/:id' },
    { method: 'delete', path: '/catalogo/produtos/:id' },
    { method: 'patch', path: '/:id' },
    { method: 'post', path: '/:id/cancelar' },
    { method: 'post', path: '/:id/arquivar' },
    { method: 'get', path: '/:id' },
    { method: 'get', path: '/:id/pdf' },
    { method: 'get', path: '/:id/xml' }
  ];

  for (const route of protectedRoutes) {
    const handlers = getRouteHandlers(route.path, route.method);
    assert.equal(handlers.includes(requireAuth), true, `${route.method.toUpperCase()} ${route.path} deve exigir autenticação`);
    assert.equal(handlers.includes(requireMeiEnabled), true, `${route.method.toUpperCase()} ${route.path} deve exigir MEI habilitado`);
  }
});

test('webhook de mei-notas não usa middleware de usuário', () => {
  const handlers = getRouteHandlers('/webhook', 'post');

  assert.deepEqual(handlers, [controller.webhook]);
});

test('router principal mantém alias legado /notas para mei-notas', () => {
  const mounts = indexRouter.stack.filter((layer) => layer.handle === router);
  const hasOfficialMount = mounts.some((layer) => String(layer.regexp).includes('^\\/mei-notas'));
  const hasLegacyMount = mounts.some((layer) => String(layer.regexp).includes('^\\/notas'));

  assert.equal(hasOfficialMount, true, 'Mount oficial /mei-notas não encontrado');
  assert.equal(hasLegacyMount, true, 'Alias legado /notas não encontrado');
});

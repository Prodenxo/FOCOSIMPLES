import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/mei-guide.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { requireMeiEnabled } from '../src/middlewares/requireMei.js';
import * as controller from '../src/controllers/mei-guide.controller.js';

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} não encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('PATCH /certificate/emitente-nfse exige auth e MEI habilitado', () => {
  const handlers = getRouteHandlers('/certificate/emitente-nfse', 'patch');
  assert.equal(handlers.includes(requireAuth), true);
  assert.equal(handlers.includes(requireMeiEnabled), true);
  assert.equal(handlers.includes(controller.patchCertificateEmitenteNfse), true);
});

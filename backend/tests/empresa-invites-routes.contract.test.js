import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../src/routes/empresa-invites.routes.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { inviteValidateRateLimit } from '../src/middlewares/invite-validate-rate-limit.js';
import * as controller from '../src/controllers/empresa-invites.controller.js';

const getRouteStack = (path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path
    && Boolean(item.route?.methods?.[method])
  ));
  assert.ok(layer, `Rota ${method.toUpperCase()} ${path} nao encontrada`);
  return layer.route.stack.map((item) => item.handle);
};

test('rotas /invites: validate público com rate limit; demais com requireAuth', () => {
  const publicGet = getRouteStack('/validate', 'get');
  assert.equal(publicGet.includes(inviteValidateRateLimit), true);
  assert.equal(publicGet.includes(controller.validateInviteGet), true);
  assert.equal(publicGet.includes(requireAuth), false);

  const publicPost = getRouteStack('/validate', 'post');
  assert.equal(publicPost.includes(inviteValidateRateLimit), true);
  assert.equal(publicPost.includes(controller.validateInvitePost), true);

  const createStack = getRouteStack('/', 'post');
  assert.equal(createStack.includes(requireAuth), true);
  assert.equal(createStack.includes(controller.createInvite), true);

  const listStack = getRouteStack('/', 'get');
  assert.equal(listStack.includes(requireAuth), true);
  assert.equal(listStack.includes(controller.listInvites), true);

  const acceptStack = getRouteStack('/accept', 'post');
  assert.equal(acceptStack.includes(requireAuth), true);
  assert.equal(acceptStack.includes(controller.acceptInvite), true);

  const revokeStack = getRouteStack('/:inviteId/revoke', 'post');
  assert.equal(revokeStack.includes(requireAuth), true);
  assert.equal(revokeStack.includes(controller.revokeInvite), true);

  const revokePatchStack = getRouteStack('/:inviteId/revoke', 'patch');
  assert.equal(revokePatchStack.includes(requireAuth), true);
  assert.equal(revokePatchStack.includes(controller.revokeInvite), true);
});

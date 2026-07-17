import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setGetRequesterContextForTests,
  requireMeiEnabled
} from '../src/middlewares/requireMei.js';

const runMiddleware = async (resolver) => {
  const req = { accessToken: 'token' };
  let nextArg;

  __setGetRequesterContextForTests(resolver);
  try {
    await requireMeiEnabled(req, {}, (arg) => {
      nextArg = arg;
    });
    return { req, nextArg };
  } finally {
    __setGetRequesterContextForTests(null);
  }
};

test('requireMeiEnabled bloqueia usuario com mei=false', async () => {
  const context = { role: 'usuario', mei: false };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(req.requesterContext, undefined);
  assert.equal(nextArg?.status, 403);
  assert.match(String(nextArg?.message || ''), /Acesso MEI desabilitado/);
});

test('requireMeiEnabled bloqueia admin com mei=false', async () => {
  const context = { role: 'admin', mei: false };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(req.requesterContext, undefined);
  assert.equal(nextArg?.status, 403);
  assert.match(String(nextArg?.message || ''), /Acesso MEI desabilitado/);
});

test('requireMeiEnabled bloqueia admin com mei=null', async () => {
  const context = { role: 'admin', mei: null };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(req.requesterContext, undefined);
  assert.equal(nextArg?.status, 403);
});

test('requireMeiEnabled permite admin com mei=true', async () => {
  const context = { role: 'admin', mei: true };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(nextArg, undefined);
  assert.deepEqual(req.requesterContext, context);
});

test('requireMeiEnabled permite superadmin com mei=false', async () => {
  const context = { role: 'superadmin', mei: false };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(nextArg, undefined);
  assert.deepEqual(req.requesterContext, context);
});

test('requireMeiEnabled permite usuario com mei=true', async () => {
  const context = { role: 'usuario', mei: true };
  const { req, nextArg } = await runMiddleware(async () => context);

  assert.equal(nextArg, undefined);
  assert.deepEqual(req.requesterContext, context);
});

test('requireMeiEnabled encaminha erro do contexto', async () => {
  const expectedError = new Error('falha ao buscar contexto');
  const { req, nextArg } = await runMiddleware(async () => {
    throw expectedError;
  });

  assert.equal(req.requesterContext, undefined);
  assert.equal(nextArg, expectedError);
});

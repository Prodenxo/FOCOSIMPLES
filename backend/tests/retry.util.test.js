import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/utils/retry.js';

test('withRetry retorna resultado imediatamente em sucesso', async () => {
  let calls = 0;
  const result = await withRetry(async () => { calls++; return 42; });
  assert.equal(result, 42);
  assert.equal(calls, 1);
});

test('withRetry tenta novamente em ECONNRESET via cause.code', async () => {
  let calls = 0;
  const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw err;
    return 'ok';
  }, { maxAttempts: 3, delayMs: 0 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('withRetry lança após esgotar tentativas', async () => {
  const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
  await assert.rejects(
    () => withRetry(async () => { throw err; }, { maxAttempts: 2, delayMs: 0 }),
    /fetch failed/
  );
});

test('withRetry não retenta em erro não transiente', async () => {
  let calls = 0;
  const err = new Error('campo ausente');
  await assert.rejects(
    () => withRetry(async () => { calls++; throw err; }, { maxAttempts: 3, delayMs: 0 }),
    /campo ausente/
  );
  assert.equal(calls, 1);
});

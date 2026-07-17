import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPayloadNoImpersonation,
  resolveOpenclawCallerPhone,
} from '../src/services/openclaw-sender-guard.service.js';
test('resolveOpenclawCallerPhone rejeita body diferente do remetente', () => {
  assert.throws(
    () =>
      resolveOpenclawCallerPhone({
        bodyPhone: '5521111111111',
        senderPhone: '5521999999999',
        enforce: true,
      }),
    (err) => err.status === 403,
  );
});

test('resolveOpenclawCallerPhone exige header remetente em modo estrito', () => {
  assert.throws(
    () =>
      resolveOpenclawCallerPhone({
        bodyPhone: '5521999999999',
        senderPhone: '',
        enforce: true,
      }),
    (err) => err.status === 403 && /X-WhatsApp-Sender/.test(err.message),
  );
});

test('resolveOpenclawCallerPhone aceita só remetente verificado', () => {
  const r = resolveOpenclawCallerPhone({
    bodyPhone: '5521999999999',
    senderPhone: '5521999999999',
    enforce: true,
  });
  assert.equal(r.phone, '5521999999999');
  assert.equal(r.enforced, true);
});

test('assertPayloadNoImpersonation bloqueia phone alheio no payload', () => {
  assert.throws(
    () =>
      assertPayloadNoImpersonation(
        { phone: '5521111111111' },
        '5521999999999',
        'list_transactions',
      ),
    (err) => err.status === 403,
  );
});

test('assertPayloadNoImpersonation permite subjectPhone só em DAS', () => {
  assert.doesNotThrow(() =>
    assertPayloadNoImpersonation(
      { subjectPhone: '5521111111111' },
      '5521999999999',
      'get_das_current',
    ),
  );
  assert.throws(
    () =>
      assertPayloadNoImpersonation(
        { subjectPhone: '5521111111111' },
        '5521999999999',
        'list_transactions',
      ),
    (err) => err.status === 403,
  );
});

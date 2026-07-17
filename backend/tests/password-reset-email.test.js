import assert from 'node:assert/strict';
import test from 'node:test';

test('buildRecoveryUrl monta query token_hash', () => {
  const redirectTo = 'https://meiinfinito.com.br/reset-password';
  const url = new URL(redirectTo);
  url.searchParams.set('token_hash', 'hash123');
  url.searchParams.set('type', 'recovery');
  assert.equal(
    url.toString(),
    'https://meiinfinito.com.br/reset-password?token_hash=hash123&type=recovery',
  );
});

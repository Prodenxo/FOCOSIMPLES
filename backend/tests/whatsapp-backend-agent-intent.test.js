import test from 'node:test';
import assert from 'node:assert/strict';
import { matchQuickWhatsappIntent } from '../src/services/whatsapp-backend-agent-intent.js';

test('pedido de saldo vira get_saldo sem esperar o modelo', () => {
  assert.deepEqual(matchQuickWhatsappIntent('qual meu saldo?'), {
    action: 'get_saldo',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('Qual meu saldo?'), {
    action: 'get_saldo',
    payload: {},
  });
  assert.deepEqual(matchQuickWhatsappIntent('quanto eu tenho'), {
    action: 'get_saldo',
    payload: {},
  });
});

test('pedido de DAS ou nota não vira atalho de saldo', () => {
  assert.equal(matchQuickWhatsappIntent('qual o saldo do DAS'), null);
  assert.equal(matchQuickWhatsappIntent('emitir nota'), null);
  assert.equal(matchQuickWhatsappIntent('Oi'), null);
});

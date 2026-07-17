import test from 'node:test';
import assert from 'node:assert/strict';
import { isGreetingOnlyMessage } from '../src/services/openclaw-chat-guard.service.js';
import { getWhatsappWelcomeMessage } from '../src/services/whatsapp-welcome.service.js';

test('isGreetingOnlyMessage reconhece tudo bom e oi', () => {
  assert.equal(isGreetingOnlyMessage('oi'), true);
  assert.equal(isGreetingOnlyMessage('tudo bom?'), true);
  assert.equal(isGreetingOnlyMessage('Bom dia!'), true);
  assert.equal(isGreetingOnlyMessage('quais minhas categorias'), false);
});

test('getWhatsappWelcomeMessage tem texto padrão', () => {
  const msg = getWhatsappWelcomeMessage();
  assert.match(msg, /Midas/i);
  assert.match(msg, /Meu Financeiro/i);
});

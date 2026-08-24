import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenclawHookAgentPayload,
  extractOpenclawHookAgentReply,
  resolveOpenclawHooksAgentUrlFrom,
} from '../src/services/openclaw-hook-relay.service.js';

test('resolveOpenclawHooksAgentUrlFrom aceita URL /hooks/agent directa', () => {
  assert.equal(
    resolveOpenclawHooksAgentUrlFrom('https://gw.example.com/hooks/agent'),
    'https://gw.example.com/hooks/agent',
  );
});

test('resolveOpenclawHooksAgentUrlFrom deriva /agent de /hooks', () => {
  assert.equal(
    resolveOpenclawHooksAgentUrlFrom('https://gw.example.com/hooks'),
    'https://gw.example.com/hooks/agent',
  );
});

test('buildOpenclawHookAgentPayload inclui telefone e waitForResult', () => {
  const payload = buildOpenclawHookAgentPayload({
    phone: '5521996185328',
    text: 'qual meu saldo',
    messageId: 'mid-42',
    hasAudio: false,
  });

  assert.equal(payload.deliver, false);
  assert.equal(payload.waitForResult, true);
  assert.equal(payload.announceToMain, false);
  assert.match(payload.message, /5521996185328/);
  assert.match(payload.message, /qual meu saldo/);
  assert.equal(payload.sessionKey, undefined);
  assert.match(payload.agentHint, /mandatorySenderPhone=5521996185328/);
});

test('extractOpenclawHookAgentReply lê result e outputText', () => {
  assert.equal(
    extractOpenclawHookAgentReply({ status: 'completed', result: 'Olá Midas' }),
    'Olá Midas',
  );
  assert.equal(
    extractOpenclawHookAgentReply({ outputText: 'PDF enviado' }),
    'PDF enviado',
  );
  assert.equal(
    extractOpenclawHookAgentReply({ data: { result: 'nested' } }),
    'nested',
  );
  assert.equal(extractOpenclawHookAgentReply({ status: 'completed' }), null);
});

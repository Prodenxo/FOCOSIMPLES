import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInboundDedupKeys,
  claimInboundMessage,
} from '../src/services/openclaw-reply-dedup.service.js';

test('buildInboundDedupKeys junta messageId e telefone+texto', () => {
  const keys = buildInboundDedupKeys({
    phone: '5521996185328',
    text: 'Qual meu saldo',
    messageId: 'mid-1',
  });
  assert.ok(keys.includes('id:mid-1'));
  assert.ok(keys.includes('txt:5521996185328:qual meu saldo'));
});

test('claimInboundMessage reconhece retry com outro messageId e o mesmo texto', () => {
  const token = `saldo-${Date.now()}`;
  const first = claimInboundMessage(buildInboundDedupKeys({
    phone: '5521996185328',
    text: token,
    messageId: 'a',
  }));
  const retry = claimInboundMessage(buildInboundDedupKeys({
    phone: '5521996185328',
    text: token,
    messageId: 'b',
  }));
  assert.equal(first, true);
  assert.equal(retry, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseZapiInbound } from '../src/services/zapi-inbound.service.js';

test('parseZapiInbound ignora fromMe', () => {
  const r = parseZapiInbound({
    type: 'ReceivedCallback',
    phone: '5548123456789',
    fromMe: true,
    text: { message: 'x' },
  });
  assert.equal(r.ignored, true);
  assert.equal(r.reason, 'from_me');
});

test('parseZapiInbound ignora grupo', () => {
  const r = parseZapiInbound({
    type: 'ReceivedCallback',
    phone: '5548123456789',
    isGroup: true,
    text: { message: 'x' },
  });
  assert.equal(r.ignored, true);
  assert.equal(r.reason, 'group');
});

test('parseZapiInbound extrai texto e telefone', () => {
  const r = parseZapiInbound({
    type: 'ReceivedCallback',
    phone: '5548123456789',
    fromMe: false,
    isGroup: false,
    messageId: 'mid1',
    instanceId: 'i1',
    text: { message: '  olá  ' },
  });
  assert.equal(r.ignored, false);
  if (!r.ignored) {
    assert.equal(r.phone, '5548123456789');
    assert.equal(r.text, 'olá');
    assert.equal(r.messageId, 'mid1');
    assert.equal(r.instanceId, 'i1');
  }
});

test('parseZapiInbound marca hasAudio em nota de voz', () => {
  const r = parseZapiInbound({
    type: 'ReceivedCallback',
    phone: '5548123456789',
    fromMe: false,
    isGroup: false,
    audio: {
      audioUrl: 'https://cdn.z-api.io/audio.ogg',
      mimeType: 'audio/ogg',
      ptt: true,
    },
  });
  assert.equal(r.ignored, false);
  if (!r.ignored) {
    assert.equal(r.text, '');
    assert.equal(r.hasAudio, true);
  }
});

test('parseZapiInbound aceita primeiro item de array', () => {
  const r = parseZapiInbound([
    {
      type: 'ReceivedCallback',
      phone: '55 48 99999-0000',
      text: { message: 'ping' },
    },
  ]);
  assert.equal(r.ignored, false);
  if (!r.ignored) {
    assert.equal(r.phone, '5548999990000');
    assert.equal(r.text, 'ping');
  }
});

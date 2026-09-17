import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_NFSE_META,
  buildNotaTerminalFailureMessage,
  isOpenclawNfseAutoWhatsappEnabled,
} from '../src/services/nfse-whatsapp-delivery.service.js';

test('buildNotaTerminalFailureMessage — rejeição avisa o utilizador com o motivo', () => {
  const msg = buildNotaTerminalFailureMessage(
    'rejeitado',
    'E0714 — Arquivo enviado com erro na assinatura.',
  );
  assert.match(msg, /rejeitada pela prefeitura/);
  assert.match(msg, /Motivo: E0714/);
});

test('buildNotaTerminalFailureMessage — sem motivo não inventa linha vazia', () => {
  const msg = buildNotaTerminalFailureMessage('cancelado');
  assert.match(msg, /foi cancelada/);
  assert.doesNotMatch(msg, /Motivo:/);
});

test('buildNotaTerminalFailureMessage — status desconhecido tem texto seguro', () => {
  assert.match(buildNotaTerminalFailureMessage('xpto'), /não foi autorizada/);
});

test('isOpenclawNfseAutoWhatsappEnabled — lê env', () => {
  const prev = process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED;
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = 'false';
  assert.equal(isOpenclawNfseAutoWhatsappEnabled(), false);
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = 'true';
  assert.equal(isOpenclawNfseAutoWhatsappEnabled(), true);
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = prev;
});

test('OPENCLAW_NFSE_META chaves estáveis', () => {
  assert.equal(OPENCLAW_NFSE_META.PENDING, 'openclawWhatsappPdfPending');
  assert.equal(OPENCLAW_NFSE_META.PHONE, 'openclawWhatsappPhone');
  assert.equal(OPENCLAW_NFSE_META.SENT_AT, 'openclawWhatsappPdfSentAt');
  assert.equal(OPENCLAW_NFSE_META.SENDING_AT, 'openclawWhatsappPdfSendingAt');
});

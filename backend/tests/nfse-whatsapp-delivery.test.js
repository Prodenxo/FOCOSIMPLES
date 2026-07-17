import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_NFSE_META,
  isOpenclawNfseAutoWhatsappEnabled,
} from '../src/services/nfse-whatsapp-delivery.service.js';

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

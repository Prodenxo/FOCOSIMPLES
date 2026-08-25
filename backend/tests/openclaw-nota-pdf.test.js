import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOpenclawNotaPdfReadyStatus,
} from '../src/services/openclaw-nota-pdf.service.js';
import {
  isOpenclawNfeAutoWhatsappEnabled,
  isOpenclawNotaAutoWhatsappEnabled,
} from '../src/services/nfse-whatsapp-delivery.service.js';

test('isOpenclawNotaPdfReadyStatus aceita concluido e autorizada', () => {
  assert.equal(isOpenclawNotaPdfReadyStatus('concluido'), true);
  assert.equal(isOpenclawNotaPdfReadyStatus('AUTORIZADA'), true);
  assert.equal(isOpenclawNotaPdfReadyStatus('processando'), false);
});

test('isOpenclawNfeAutoWhatsappEnabled herda flag NFSe quando NFE vazio', () => {
  const prevNfe = process.env.OPENCLAW_NFE_AUTO_WHATSAPP_ENABLED;
  const prevNfse = process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED;
  process.env.OPENCLAW_NFE_AUTO_WHATSAPP_ENABLED = '';
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = 'true';
  assert.equal(isOpenclawNfeAutoWhatsappEnabled(), true);
  assert.equal(isOpenclawNotaAutoWhatsappEnabled('NFE'), true);
  process.env.OPENCLAW_NFE_AUTO_WHATSAPP_ENABLED = prevNfe ?? '';
  process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED = prevNfse ?? 'false';
});

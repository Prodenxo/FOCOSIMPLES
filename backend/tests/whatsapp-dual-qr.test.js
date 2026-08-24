import test from 'node:test';
import assert from 'node:assert/strict';

import { isWhatsappDualQrMode } from '../src/services/whatsapp-dual-qr.service.js';

test('isWhatsappDualQrMode: false por padrão', () => {
  const prev = process.env.WHATSAPP_DUAL_QR_MODE;
  delete process.env.WHATSAPP_DUAL_QR_MODE;
  assert.equal(isWhatsappDualQrMode(), false);
  process.env.WHATSAPP_DUAL_QR_MODE = prev;
});

test('isWhatsappDualQrMode: true quando env=true', () => {
  const prev = process.env.WHATSAPP_DUAL_QR_MODE;
  process.env.WHATSAPP_DUAL_QR_MODE = 'true';
  assert.equal(isWhatsappDualQrMode(), true);
  process.env.WHATSAPP_DUAL_QR_MODE = prev;
});

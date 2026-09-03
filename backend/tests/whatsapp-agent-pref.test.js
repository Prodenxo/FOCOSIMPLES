import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsappAgentPrefView,
  normalizeWhatsappEngine,
} from '../src/services/whatsapp-agent-pref.service.js';
import { summarizeActionResult } from '../src/services/whatsapp-backend-agent.service.js';

test('normalizeWhatsappEngine cai no OpenClaw se vier vazio ou inválido', () => {
  assert.equal(normalizeWhatsappEngine(''), 'openclaw');
  assert.equal(normalizeWhatsappEngine('BACKEND'), 'backend');
  assert.equal(normalizeWhatsappEngine('outro'), 'openclaw');
});

test('toggle ligado significa OpenClaw; desligado significa backend', () => {
  assert.equal(buildWhatsappAgentPrefView({ engine: 'openclaw' }).openclawEnabled, true);
  assert.equal(buildWhatsappAgentPrefView({ engine: 'backend' }).openclawEnabled, false);
  assert.equal(buildWhatsappAgentPrefView({ engine: 'backend' }).engine, 'backend');
});

test('summarizeActionResult esconde PDF e textos enormes', () => {
  const out = summarizeActionResult({
    ok: true,
    message: 'Guia pronta',
    data: {
      pdfBase64: 'A'.repeat(400),
      filename: 'DAS.pdf',
    },
  });
  assert.equal(out.data.pdfBase64, '[omitido]');
  assert.equal(out.data.filename, 'DAS.pdf');
});

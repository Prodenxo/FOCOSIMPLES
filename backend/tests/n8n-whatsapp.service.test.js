import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.N8N_WHATSAPP_WEBHOOK_URL =
  process.env.N8N_WHATSAPP_WEBHOOK_URL || 'https://example.com/webhook';

test('n8n whatsapp service normaliza erro de webhook não registrado', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 404,
    headers: new Headers({ 'content-type': 'text/plain' }),
    text: async () => 'The requested webhook "POST admin-mei-whatsapp" is not registered.'
  });

  try {
    const { sendWhatsappViaN8nWebhook } = await import('../src/services/n8n-whatsapp.service.js');
    await assert.rejects(
      () => sendWhatsappViaN8nWebhook({ foo: 'bar' }),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(
          err.message,
          'Webhook do WhatsApp não está ativo/registrado. Verifique o endpoint no n8n.'
        );
        return true;
      }
    );
  } finally {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  }
});

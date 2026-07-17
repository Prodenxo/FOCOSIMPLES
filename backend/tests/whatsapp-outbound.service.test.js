import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('sendWhatsappMessage usa Z-API quando configurada (modo auto)', async () => {
  process.env.WHATSAPP_OUTBOUND_MODE = 'auto';
  process.env.ZAPI_INSTANCE_ID = 'inst';
  process.env.ZAPI_TOKEN = 'tok';
  process.env.ZAPI_CLIENT_TOKEN = 'client';
  process.env.N8N_WHATSAPP_WEBHOOK_URL = 'https://example.com/n8n-should-not-call';

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /send-text/);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    };
  };

  try {
    const { sendWhatsappMessage } = await import('../src/services/whatsapp-outbound.service.js');
    const result = await sendWhatsappMessage({
      phone: '5511999999999',
      message: 'teste',
    });
    assert.equal(result.channel, 'zapi');
  } finally {
    if (originalFetch) global.fetch = originalFetch;
    else delete global.fetch;
  }
});

test('isWhatsappOutboundConfigured detecta zapi ou n8n', async () => {
  process.env.ZAPI_INSTANCE_ID = '';
  process.env.ZAPI_TOKEN = '';
  process.env.ZAPI_CLIENT_TOKEN = '';
  process.env.N8N_WHATSAPP_WEBHOOK_URL = 'https://example.com/hook';

  const { isWhatsappOutboundConfigured, getWhatsappOutboundChannel } = await import(
    '../src/services/whatsapp-outbound.service.js'
  );
  assert.equal(isWhatsappOutboundConfigured(), true);
  assert.equal(getWhatsappOutboundChannel(), 'n8n');
});

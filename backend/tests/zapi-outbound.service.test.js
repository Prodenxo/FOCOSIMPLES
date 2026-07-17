import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('normalizeZapiPhone adiciona 55 em número local', async () => {
  const { normalizeZapiPhone } = await import('../src/services/zapi-outbound.service.js');
  assert.equal(normalizeZapiPhone('11987654321'), '5511987654321');
  assert.equal(normalizeZapiPhone('5511987654321'), '5511987654321');
});

test('sendZapiText chama send-text com Client-Token', async () => {
  process.env.ZAPI_INSTANCE_ID = 'inst-test';
  process.env.ZAPI_TOKEN = 'tok-test';
  process.env.ZAPI_CLIENT_TOKEN = 'client-test';

  const originalFetch = global.fetch;
  let capturedUrl = '';
  let capturedBody = null;
  let capturedHeaders = null;

  global.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(init.body);
    capturedHeaders = init.headers;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ zaapId: '1' }),
    };
  };

  try {
    const { sendZapiText } = await import('../src/services/zapi-outbound.service.js');
    const result = await sendZapiText({
      phone: '11987654321',
      message: 'Olá',
    });
    assert.equal(result.status, 200);
    assert.match(capturedUrl, /send-text$/);
    assert.equal(capturedBody.phone, '5511987654321');
    assert.equal(capturedBody.message, 'Olá');
    assert.equal(capturedHeaders['Client-Token'], 'client-test');
  } finally {
    if (originalFetch) global.fetch = originalFetch;
    else delete global.fetch;
  }
});

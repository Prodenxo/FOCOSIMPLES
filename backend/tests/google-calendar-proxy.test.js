import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('proxy Google Calendar aceita apenas rotas/metodos permitidos', async () => {
  const { isAllowedProxyRoute } = await import('../src/controllers/googleCalendar.controller.js');

  assert.equal(isAllowedProxyRoute('check-auth', 'GET'), true);
  assert.equal(isAllowedProxyRoute('auth', 'GET'), true);
  assert.equal(isAllowedProxyRoute('callback', 'POST'), true);
  assert.equal(isAllowedProxyRoute('events', 'GET'), true);
  assert.equal(isAllowedProxyRoute('create-event', 'POST'), true);
  assert.equal(isAllowedProxyRoute('disconnect', 'DELETE'), true);
  assert.equal(isAllowedProxyRoute('disconnect', 'POST'), true);

  assert.equal(isAllowedProxyRoute('callback', 'GET'), false);
  assert.equal(isAllowedProxyRoute('events', 'POST'), false);
  assert.equal(isAllowedProxyRoute('unknown', 'GET'), false);
});

test('proxy Google Calendar libera os compromissos da agenda', async () => {
  const { isAllowedProxyRoute } = await import('../src/controllers/googleCalendar.controller.js');

  assert.equal(isAllowedProxyRoute('create-custom-event', 'POST'), true);
  assert.equal(isAllowedProxyRoute('update-custom-event', 'POST'), true);
  assert.equal(isAllowedProxyRoute('delete-custom-event', 'POST'), true);

  assert.equal(isAllowedProxyRoute('create-custom-event', 'GET'), false);
  assert.equal(isAllowedProxyRoute('delete-custom-event', 'DELETE'), false);
});

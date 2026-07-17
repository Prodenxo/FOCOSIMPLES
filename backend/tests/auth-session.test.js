import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('auth.service valida entrada de signIn/signUp', async () => {
  const authService = await import('../src/services/auth.service.js');

  await assert.rejects(
    () => authService.signIn({ email: '', password: '' }),
    /Email e senha são obrigatórios/
  );

  await assert.rejects(
    () => authService.signUp({ email: '', password: '' }),
    /Email e senha são obrigatórios/
  );
});

test('auth.service getSession retorna null sem token', async () => {
  const authService = await import('../src/services/auth.service.js');
  const session = await authService.getSession();
  assert.equal(session, null);
});

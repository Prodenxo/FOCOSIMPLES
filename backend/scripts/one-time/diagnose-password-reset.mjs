/**
 * Diagnóstico: recuperação de senha Supabase.
 * Uso: node scripts/one-time/diagnose-password-reset.mjs seu@email.com
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Informe o e-mail: node scripts/one-time/diagnose-password-reset.mjs user@example.com');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const redirectTo = frontendUrl ? `${frontendUrl}/reset-password` : '(não definido — usa Site URL do Supabase)';

if (!url || !serviceKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient(url, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('--- Diagnóstico recuperação de senha ---');
console.log('E-mail:', email);
console.log('FRONTEND_URL redirectTo:', redirectTo);
console.log('');

// 1) Usuário existe?
const { data: listData, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) {
  console.error('Erro ao listar usuários:', listError.message);
  process.exit(1);
}

const user = listData.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.log('❌ Usuário NÃO encontrado no Supabase Auth.');
  console.log('   O Supabase retorna sucesso mas NÃO envia e-mail para endereços inexistentes.');
  console.log('   Cadastre o usuário ou use o e-mail exato do login.');
  process.exit(0);
}

console.log('✅ Usuário encontrado:', user.id);
console.log('   Confirmado:', user.email_confirmed_at ? 'sim' : 'não');
console.log('   Último login:', user.last_sign_in_at || 'nunca');
console.log('');

// 2) generateLink (não envia e-mail, só gera link)
const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: redirectTo !== '(não definido — usa Site URL do Supabase)' ? { redirectTo } : undefined,
});

if (linkError) {
  console.log('❌ generateLink falhou:', linkError.message);
} else {
  console.log('✅ generateLink OK (link gerado internamente, não envia e-mail sozinho)');
  const actionLink = linkData?.properties?.action_link;
  if (actionLink) {
    console.log('   action_link (primeiros 80 chars):', actionLink.slice(0, 80) + '...');
  }
}
console.log('');

// 3) resetPasswordForEmail (envia e-mail via Supabase)
const { error: resetError } = await anon.auth.resetPasswordForEmail(email, {
  redirectTo: redirectTo !== '(não definido — usa Site URL do Supabase)' ? redirectTo : undefined,
});

if (resetError) {
  console.log('❌ resetPasswordForEmail falhou:', resetError.message);
  console.log('   Status:', resetError.status);
} else {
  console.log('✅ resetPasswordForEmail retornou sucesso (Supabase aceitou o pedido).');
  console.log('   Se o e-mail não chegar: spam, rate limit (~4/h), ou SMTP customizado no painel Supabase.');
}

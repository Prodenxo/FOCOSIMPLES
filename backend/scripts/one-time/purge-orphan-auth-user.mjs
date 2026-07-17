/**
 * Remove conta órfã do Supabase Auth (sem role_x_user_x_empresa).
 * Uso: node scripts/one-time/purge-orphan-auth-user.mjs <userId|email>
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { purgeUserData } from '../../src/services/users.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const target = process.argv[2]?.trim();
if (!target) {
  console.error('Uso: node scripts/one-time/purge-orphan-auth-user.mjs <userId|email>');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId = target;
if (target.includes('@')) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const found = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
  if (!found) {
    console.error('Utilizador não encontrado:', target);
    process.exit(1);
  }
  userId = found.id;
}

const { data: link } = await admin
  .from('role_x_user_x_empresa')
  .select('id')
  .eq('user_id', userId)
  .limit(1);

if ((link || []).length > 0) {
  console.error('Conta ainda tem vínculo em role_x_user_x_empresa — use DELETE /api/users/:id no painel.');
  process.exit(1);
}

const { data: authUser } = await admin.auth.admin.getUserById(userId);
if (!authUser?.user) {
  console.log('Auth user já não existe:', userId);
  process.exit(0);
}

console.log('A remover:', authUser.user.email, userId);
await purgeUserData(admin, userId);

const { error: delErr } = await admin.auth.admin.deleteUser(userId);
if (delErr) {
  console.error('Falha ao apagar auth.users:', delErr.message);
  process.exit(1);
}

console.log('Conta órfã removida com sucesso.');

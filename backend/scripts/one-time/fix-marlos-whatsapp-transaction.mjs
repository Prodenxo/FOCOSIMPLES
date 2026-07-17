/**
 * Corrige lançamento WhatsApp na conta errada (Marlos — Jun/2026).
 * Uso: node scripts/one-time/fix-marlos-whatsapp-transaction.mjs
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { assignN8nPhoneToUser } from '../../src/services/n8n-link-phone.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const TX_ID = '30a7f0fb-bb79-49b8-b5ea-d35abf2c3aea';
const CORRECT_USER_ID = '4046eddb-c494-45b5-890d-e9581487d9e8';
const ORPHAN_USER_ID = '39ed4471-0c99-4de5-bf2c-4bf3054c82d4';
const PHONE = '5521972749998';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tx, error: txErr } = await admin
  .from('lancamentos_id')
  .select('id,user_id,valor,classificacao')
  .eq('id', TX_ID)
  .maybeSingle();

if (txErr) {
  console.error('Erro ao buscar transação:', txErr.message);
  process.exit(1);
}

if (!tx) {
  console.log('Transação não encontrada — nada a fazer.');
  process.exit(0);
}

if (tx.user_id === CORRECT_USER_ID) {
  console.log('Transação já está na conta correta.');
} else {
  const { error: moveErr } = await admin
    .from('lancamentos_id')
    .update({ user_id: CORRECT_USER_ID })
    .eq('id', TX_ID);

  if (moveErr) {
    console.error('Falha ao mover transação:', moveErr.message);
    process.exit(1);
  }
  console.log(`Transação ${TX_ID} movida para ${CORRECT_USER_ID}`);
}

await assignN8nPhoneToUser(admin, CORRECT_USER_ID, PHONE);

const { error: delOrphan } = await admin
  .from('n8n_link')
  .delete()
  .eq('user_id', ORPHAN_USER_ID);

if (delOrphan) {
  console.warn('Aviso ao limpar n8n_link órfão:', delOrphan.message);
} else {
  console.log('Vínculo WhatsApp órfão removido de', ORPHAN_USER_ID);
}

const { data: links } = await admin
  .from('n8n_link')
  .select('user_id,user_number')
  .or(`user_number.eq.${PHONE},user_number.eq.21972749998`);

console.log('n8n_link após correção:', links);
console.log('Concluído — Marlos deve ver R$ 95 em marlos.machado@cfvargens.com.br');

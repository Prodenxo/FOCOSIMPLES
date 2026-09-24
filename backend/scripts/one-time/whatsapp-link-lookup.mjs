/**
 * Diagnóstico read-only: a quem pertence um número de WhatsApp no vínculo n8n_link.
 * Uso: node scripts/one-time/whatsapp-link-lookup.mjs 5521984503232 5521996185377
 */
import { query } from '../../src/config/pg.js';

const args = process.argv.slice(2).map((v) => v.replace(/\D/g, '')).filter(Boolean);
if (args.length === 0) {
  console.error('Informe pelo menos um número (só dígitos).');
  process.exit(1);
}

for (const digits of args) {
  const tail = digits.slice(-8);
  const { rows: links } = await query(
    `SELECT n.user_number, n.user_id, u.email, u.phone
     FROM public.n8n_link n
     LEFT JOIN public.users u ON u.id = n.user_id
     WHERE n.user_number LIKE '%' || $1 || '%'`,
    [tail],
  );
  const { rows: users } = await query(
    `SELECT id, email, phone, raw_user_meta_data->>'display_name' AS display_name
     FROM public.users
     WHERE (phone LIKE '%' || $1 || '%' OR raw_user_meta_data->>'phone' LIKE '%' || $1 || '%')
       AND deleted_at IS NULL`,
    [tail],
  );

  console.log(`\n=== ${digits} (busca por ...${tail}) ===`);
  console.log('n8n_link:', links.length ? JSON.stringify(links, null, 2) : 'nenhum vínculo');
  console.log('users:', users.length ? JSON.stringify(users, null, 2) : 'nenhum usuário');
}

process.exit(0);

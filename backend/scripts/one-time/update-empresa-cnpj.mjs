#!/usr/bin/env node
/**
 * Atualiza CNPJ da empresa vinculada a um usuário (por e-mail).
 *
 * Uso (backend/, .env com DATABASE_URL + AUTH_MODE=local):
 *   node scripts/one-time/update-empresa-cnpj.mjs --email=leo.irak@hotmail.com --cnpj=43627677000167
 *   node scripts/one-time/update-empresa-cnpj.mjs --email=leo.irak@hotmail.com --cnpj=43627677000167 --apply
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../src/config/pg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const emailArg = args.find((a) => a.startsWith('--email='));
const cnpjArg = args.find((a) => a.startsWith('--cnpj='));

const email = emailArg?.split('=').slice(1).join('=').trim().toLowerCase();
const cnpj = onlyDigits(cnpjArg?.split('=').slice(1).join('='));

if (!email || cnpj.length !== 14) {
  console.error('Uso: node update-empresa-cnpj.mjs --email=... --cnpj=14digitos [--apply]');
  process.exit(1);
}

const findContext = async () => {
  const { rows } = await query(
    `SELECT
       u.id AS user_id,
       u.email,
       u.raw_user_meta_data,
       e.id AS empresa_id,
       e.empresa,
       e.cnpj AS cnpj_atual,
       e.razao_social,
       c.cert_document AS cert_cnpj,
       c.plugnotas_cert_id
     FROM public.users u
     JOIN public.profiles p ON p.id = u.id
     LEFT JOIN public.role_x_user_x_empresa rx ON rx.user_id = u.id
     LEFT JOIN public.empresas e ON e.id = rx.empresas_id
     LEFT JOIN public.user_mei_certificates c ON c.user_id = u.id
     WHERE lower(u.email) = $1
       AND u.deleted_at IS NULL
     ORDER BY rx.created_at NULLS LAST
     LIMIT 1`,
    [email],
  );
  return rows[0] || null;
};

const run = async () => {
  const ctx = await findContext();
  if (!ctx?.empresa_id) {
    console.error(`Nenhuma empresa vinculada ao e-mail ${email}`);
    process.exit(1);
  }

  console.log('Contexto encontrado:');
  console.log(JSON.stringify({
    email: ctx.email,
    display_name: ctx.raw_user_meta_data?.display_name || ctx.raw_user_meta_data?.name || null,
    empresa_id: ctx.empresa_id,
    empresa: ctx.empresa,
    cnpj_atual: ctx.cnpj_atual,
    cnpj_novo: cnpj,
    cert_cnpj: ctx.cert_cnpj,
    plugnotas_cert_id: ctx.plugnotas_cert_id,
  }, null, 2));

  if (ctx.cnpj_atual === cnpj) {
    console.log('CNPJ já está correto — nada a fazer.');
    return;
  }

  if (ctx.cert_cnpj && onlyDigits(ctx.cert_cnpj) !== cnpj) {
    console.warn('');
    console.warn('ATENÇÃO: certificado A1 cadastrado é do CNPJ', ctx.cert_cnpj);
    console.warn('Depois da troca, será necessário subir certificado do CNPJ', cnpj);
    console.warn('e recadastrar emitente na PlugNotas.');
    console.warn('');
  }

  if (!apply) {
    console.log('Dry-run. Rode com --apply para gravar.');
    return;
  }

  await query(
    `UPDATE public.empresas
     SET cnpj = $1
     WHERE id = $2`,
    [cnpj, ctx.empresa_id],
  );

  console.log('empresas.cnpj atualizado.');

  const { rows: dup } = await query(
    `SELECT id, empresa, cnpj FROM public.empresas
     WHERE cnpj = $1 AND id <> $2`,
    [cnpj, ctx.empresa_id],
  );
  if (dup.length) {
    console.warn('AVISO: outro registro em empresas já usa este CNPJ:', dup);
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

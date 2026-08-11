#!/usr/bin/env node
/**
 * Sincroniza public.empresas a partir do GET /empresa na PlugNotas.
 *
 * Uso:
 *   node scripts/one-time/sync-empresa-from-plugnotas.mjs --email=leo.irak@hotmail.com --apply
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../src/config/pg.js';
import { consultarEmpresaPlugNotas } from '../../src/services/plugnotas/empresa.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apply = process.argv.includes('--apply');
const emailArg = process.argv.find((a) => a.startsWith('--email='));
const email = emailArg?.split('=').slice(1).join('=').trim().toLowerCase();

if (!email) {
  console.error('Uso: --email=... [--apply]');
  process.exit(1);
}

const { rows } = await query(
  `SELECT u.id AS user_id, e.id AS empresa_id, e.cnpj
   FROM public.users u
   JOIN public.role_x_user_x_empresa rx ON rx.user_id = u.id
   JOIN public.empresas e ON e.id = rx.empresas_id
   WHERE lower(u.email) = $1 AND u.deleted_at IS NULL
   LIMIT 1`,
  [email],
);

const ctx = rows[0];
if (!ctx?.empresa_id) {
  console.error('Empresa não encontrada para', email);
  process.exit(1);
}

const pn = await consultarEmpresaPlugNotas(ctx.cnpj);
const end = pn?.endereco || {};

const next = {
  empresa: pn?.razaoSocial || pn?.nomeFantasia,
  razao_social: pn?.razaoSocial,
  nome_fantasia: pn?.nomeFantasia || pn?.razaoSocial,
  cnpj: String(pn?.cpfCnpj || ctx.cnpj).replace(/\D/g, ''),
  inscricao_estadual: pn?.inscricaoEstadual || null,
  logradouro: end.logradouro || null,
  numero: end.numero || null,
  complemento: end.complemento || null,
  bairro: end.bairro || null,
  cidade: end.descricaoCidade || null,
  estado: end.estado || null,
  cep: String(end.cep || '').replace(/\D/g, '') || null,
  email: pn?.email || null,
};

console.log('PlugNotas → empresas (proposta):');
console.log(JSON.stringify(next, null, 2));

if (!apply) {
  console.log('\nDry-run. Use --apply para gravar.');
  process.exit(0);
}

await query(
  `UPDATE public.empresas SET
     empresa = COALESCE($1, empresa),
     razao_social = COALESCE($2, razao_social),
     nome_fantasia = COALESCE($3, nome_fantasia),
     cnpj = COALESCE($4, cnpj),
     inscricao_estadual = COALESCE($5, inscricao_estadual),
     logradouro = COALESCE($6, logradouro),
     numero = COALESCE($7, numero),
     complemento = COALESCE($8, complemento),
     bairro = COALESCE($9, bairro),
     cidade = COALESCE($10, cidade),
     estado = COALESCE($11, estado),
     cep = COALESCE($12, cep),
     email = COALESCE($13, email)
   WHERE id = $14`,
  [
    next.empresa,
    next.razao_social,
    next.nome_fantasia,
    next.cnpj,
    next.inscricao_estadual,
    next.logradouro,
    next.numero,
    next.complemento,
    next.bairro,
    next.cidade,
    next.estado,
    next.cep,
    next.email,
    ctx.empresa_id,
  ],
);

console.log('empresas atualizada a partir da PlugNotas.');

#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../src/config/pg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const email = 'leo.irak@hotmail.com';
const { rows: users } = await query(
  `SELECT id FROM public.users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
  [email],
);
const uid = users[0]?.id;
if (!uid) {
  console.log('user not found');
  process.exit(1);
}

const { rows: notas } = await query(
  `SELECT document_type, status, cnpj_prestador, created_at,
          response_json->>'message' AS msg,
          payload_json->'emitente'->>'cpfCnpj' AS emitente_payload
   FROM public.mei_nfse
   WHERE user_id = $1 AND document_type = 'NFE'
   ORDER BY created_at DESC
   LIMIT 5`,
  [uid],
);

const { rows: empresa } = await query(
  `SELECT cnpj, empresa, razao_social, inscricao_estadual, cidade, estado, email
   FROM public.empresas
   WHERE id = 'ab799117-229d-46db-8ed6-7a2a91afb515'`,
);

const { rows: cert } = await query(
  `SELECT cert_document, razao_social, inscricao_municipal, ibge_municipio, uf, documentos_ativos
   FROM public.user_mei_certificates WHERE user_id = $1`,
  [uid],
);

console.log(JSON.stringify({ empresa: empresa[0], cert: cert[0], notas }, null, 2));

if (notas[0]) {
  const { rows: full } = await query(
    `SELECT response_json FROM public.mei_nfse
     WHERE user_id = $1 AND document_type = 'NFE'
     ORDER BY created_at DESC LIMIT 1`,
    [uid],
  );
  console.log('\n--- response_json última NF-e ---');
  console.log(JSON.stringify(full[0]?.response_json, null, 2));
}

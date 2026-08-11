#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consultarEmpresaPlugNotas } from '../../src/services/plugnotas/empresa.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const cnpj = process.argv[2] || '43627677000167';

try {
  const data = await consultarEmpresaPlugNotas(cnpj);
  const pick = {
    cpfCnpj: data?.cpfCnpj || data?.cnpj,
    razaoSocial: data?.razaoSocial,
    inscricaoEstadual: data?.inscricaoEstadual,
    endereco: data?.endereco,
    nfe: data?.nfe,
    nfse: data?.nfse ? { ativo: data.nfse.ativo, config: data.nfse.config } : undefined,
    certificado: data?.certificado,
  };
  console.log(JSON.stringify(pick, null, 2));
} catch (err) {
  console.error('Erro:', err?.message || err);
  process.exit(1);
}

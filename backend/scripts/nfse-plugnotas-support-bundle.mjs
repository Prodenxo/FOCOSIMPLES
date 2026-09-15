/**
 * Gera pacote de diagnóstico para suporte PlugNotas/TecnoSpeed (E160 etc.).
 * Uso: node scripts/nfse-plugnotas-support-bundle.mjs --id=6aa98738...
 */
import dotenv from 'dotenv';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consultarNfse } from '../src/services/plugnotas/nfse.service.js';
import { redactPayload } from '../src/services/plugnotas/plugnotas-emit-400-log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const id = process.argv.find((a) => a.startsWith('--id='))?.slice(5)?.trim();
if (!id) {
  console.error('Informe --id=<plugnotas_nota_id>');
  process.exit(1);
}

const consulta = await consultarNfse(id);
const bundle = {
  geradoEm: new Date().toISOString(),
  notaId: id,
  protocol: consulta?.protocol,
  padrao: consulta?.padrao,
  versao: consulta?.versao,
  versaoEsquema: consulta?.versaoEsquema,
  status: consulta?.status,
  retorno: consulta?.retorno,
  idIntegracao: consulta?.idIntegracao,
  mensagemSuporte: [
    'Solicitamos o XML de envio gerado internamente e a linha/tag exata rejeitada pelo validador XSD (E160).',
    'Município: Ribeirão Preto/SP IBGE 3543402, padrão ISSNETONLINE30, versaoEsquema RTC007.',
  ].join(' '),
  consultaRedigida: redactPayload(consulta),
};

const outPath = resolve(__dirname, '..', 'tmp', `nfse-support-${id}.json`);
writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
console.log('Pacote salvo em:', outPath);

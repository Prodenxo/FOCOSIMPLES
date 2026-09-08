/**
 * Debug iterativo de NFS-e obra (gesso 07.06.02) — monta payload e opcionalmente emite.
 *
 * Uso (PowerShell, na pasta backend):
 *   node scripts/nfse-obra-emit-debug.mjs preview
 *   node scripts/nfse-obra-emit-debug.mjs preview --cno=123456789012
 *   NFSE_EMIT_DEBUG_PAYLOAD=1 npm run dev   # loga payload no backend ao emitir pela app
 *
 * Variáveis no .env (opcionais):
 *   TEST_NFSE_CNPJ_PRESTADOR=68185664000106
 *   TEST_NFSE_TOMADOR_CNPJ=...
 *   TEST_NFSE_CODIGO_SERVICO=070602
 *   TEST_NFSE_CNAE=4330403
 *   TEST_NFSE_VALOR=2
 *   TEST_NFSE_CODIGO_IBGE=3543402
 *   TEST_NFSE_OBRA_CNO=000
 *   PLUGNOTAS_API_KEY=...
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNfseEmitPayloadPreview } from '../src/services/mei-notas.service.js';
import { emitirNfse } from '../src/services/plugnotas/nfse.service.js';
import { redactPayload } from '../src/services/plugnotas/plugnotas-emit-400-log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const argv = process.argv.slice(2);
const mode = (argv.find((a) => !a.startsWith('--')) || 'preview').toLowerCase();

const readFlag = (name) => {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
};

const prestadorCnpj = (
  readFlag('prestador')
  || process.env.TEST_NFSE_CNPJ_PRESTADOR
  || '68185664000106'
).replace(/\D/g, '');

const tomadorCnpj = (
  readFlag('tomador')
  || process.env.TEST_NFSE_TOMADOR_CNPJ
  || '17422651000172'
).replace(/\D/g, '');

const codigoServico = readFlag('codigo') || process.env.TEST_NFSE_CODIGO_SERVICO || '070602';
const cnae = readFlag('cnae') || process.env.TEST_NFSE_CNAE || '4330403';
const valor = readFlag('valor') || process.env.TEST_NFSE_VALOR || '2';
const codigoIbge = (
  readFlag('ibge')
  || process.env.TEST_NFSE_CODIGO_IBGE
  || '3543402'
).replace(/\D/g, '').slice(0, 7);

const obraCno = readFlag('cno') || process.env.TEST_NFSE_OBRA_CNO || '';
const obraCei = readFlag('cei') || process.env.TEST_NFSE_OBRA_CEI || '';
const obraArt = readFlag('art') || process.env.TEST_NFSE_OBRA_ART || '';

const tomadorEndereco = {
  codigoCidade: codigoIbge,
  descricaoCidade: readFlag('cidade') || process.env.TEST_NFSE_CIDADE || 'Ribeirão Preto',
  estado: readFlag('uf') || process.env.TEST_NFSE_UF || 'SP',
  cep: (readFlag('cep') || process.env.TEST_NFSE_CEP || '14000000').replace(/\D/g, '').slice(0, 8),
  logradouro: readFlag('logradouro') || process.env.TEST_NFSE_LOGRADOURO || 'Rua Teste Obra',
  numero: readFlag('numero') || process.env.TEST_NFSE_NUMERO || '100',
  bairro: readFlag('bairro') || process.env.TEST_NFSE_BAIRRO || 'Centro',
};

const buildSampleInput = () => ({
  prestador: {
    cpfCnpj: prestadorCnpj,
    razaoSocial: process.env.TEST_NFSE_PRESTADOR_NOME || 'GESSO & CIA SILVA LTDA',
    endereco: { codigoCidade: codigoIbge, descricaoCidade: tomadorEndereco.descricaoCidade, estado: 'SP' },
  },
  tomador: {
    cpfCnpj: tomadorCnpj,
    razaoSocial: process.env.TEST_NFSE_TOMADOR_NOME || 'Fernando Carneiro',
    endereco: tomadorEndereco,
  },
  tomadorEndereco,
  servicos: [{
    codigo: codigoServico,
    cnae,
    discriminacao: process.env.TEST_NFSE_DESCRICAO || 'Serviço de gesso',
    valorServico: Number(String(valor).replace(',', '.')),
    aliquota: process.env.TEST_NFSE_ALIQUOTA || '2',
    obra: {
      usarEnderecoTomador: true,
      ...(obraCno ? { cno: obraCno } : {}),
      ...(obraCei ? { cei: obraCei } : {}),
      ...(obraArt ? { art: obraArt } : {}),
      endereco: tomadorEndereco,
    },
  }],
});

const usage = () => {
  console.error(`
Uso: node scripts/nfse-obra-emit-debug.mjs <modo> [flags]

Modos:
  preview   — monta e imprime o JSON final (padrão)
  emit      — POST na PlugNotas (nota real se produção!)
  diff      — mostra só campos críticos (obra, cidadePrestacao, ibscbs, cabeçalho RTC)

Flags:
  --cno=000              CNO da obra (vazio = placeholder "000")
  --cei=                 CEI opcional
  --art=                 ART opcional
  --valor=2              Valor do serviço
  --prestador=CNPJ       CNPJ prestador
  --tomador=CNPJ         CNPJ tomador
  --ibge=3543402         Município IBGE

Exemplos:
  node scripts/nfse-obra-emit-debug.mjs preview
  node scripts/nfse-obra-emit-debug.mjs diff --cno=000
  node scripts/nfse-obra-emit-debug.mjs emit --cno=000
`);
  process.exit(1);
};

if (argv.includes('--help') || argv.includes('-h')) usage();

const payload = buildNfseEmitPayloadPreview(buildSampleInput(), 'cli-debug', {
  codigoIbge,
  nfseNacional: false,
  simplesNacional: true,
});

const pickCritical = (full) => {
  const servico = Array.isArray(full.servico) ? full.servico[0] : full.servico;
  return {
    versao: full.versao,
    versaoEsquema: full.versaoEsquema,
    naturezaTributacao: full.naturezaTributacao,
    regimeApuracaoTributaria: full.regimeApuracaoTributaria,
    emitente: full.emitente,
    cidadePrestacao: full.cidadePrestacao,
    servico: servico ? {
      codigo: servico.codigo,
      cnae: servico.cnae,
      codigoNbs: servico.codigoNbs,
      codigoCidadeIncidencia: servico.codigoCidadeIncidencia,
      codigoTributacao: servico.codigoTributacao,
      obra: servico.obra,
      iss: servico.iss,
      ibscbs: servico.ibscbs,
    } : null,
  };
};

console.log('Modo:', mode);
console.log('Prestador:', prestadorCnpj, '| Tomador:', tomadorCnpj);
console.log('Serviço:', codigoServico, '| IBGE:', codigoIbge);
console.log('Obra CNO/CEI/ART:', obraCno || '(auto 000)', obraCei || '-', obraArt || '-');
console.log('---');

if (mode === 'diff') {
  console.log(JSON.stringify(pickCritical(payload), null, 2));
} else if (mode === 'preview') {
  console.log(JSON.stringify(redactPayload(payload), null, 2));
  console.log('\nCampos críticos:');
  console.log(JSON.stringify(pickCritical(payload), null, 2));
  console.log('\nPara emitir: node scripts/nfse-obra-emit-debug.mjs emit');
  console.log('Com log no backend: NFSE_EMIT_DEBUG_PAYLOAD=1 npm run dev');
} else if (mode === 'emit') {
  const apiKey = String(process.env.PLUGNOTAS_API_KEY || process.env.PLUGNOTAS_TOKEN || '').trim();
  if (!apiKey) {
    console.error('Defina PLUGNOTAS_API_KEY no .env para emitir.');
    process.exit(1);
  }
  console.warn('AVISO: emissão real na PlugNotas.');
  console.log('Payload crítico:', JSON.stringify(pickCritical(payload), null, 2));
  const body = [{ ...payload, idIntegracao: `obra-debug-${Date.now()}` }];
  try {
    const response = await emitirNfse(body);
    console.log('\nResposta PlugNotas:');
    console.log(JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('\nFalha na emissão:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
} else {
  usage();
}

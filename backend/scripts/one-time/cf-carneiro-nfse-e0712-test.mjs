/**
 * Teste one-shot: CF Carneiro Ribeirão — isola a causa da rejeição E0712.
 *
 * Reproduz a nota 6ab2d0642ff4df49c618447a (LC 171901 + cTribMun 171901 + NBS 113022100),
 * que foi rejeitada só por E0712 ("para ME/EPP somente um dos 3 grupos vTotTrib /
 * pTotTrib / pTotTribSN"). A única variável alterada é `iss.aliquota`: a suspeita é
 * que a alíquota padrão (2%) inventada pelo sistema vire pTotTribSN na PlugNotas
 * enquanto ela também preenche vTotTrib.
 *
 *   ALLOW_PROD_NFSE_EMIT=1 node scripts/one-time/cf-carneiro-nfse-e0712-test.mjs --serie=1 --numero=81
 *
 * Use --com-aliquota para emitir o controle (mantendo os 2%).
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNfseEmitPayloadPreview } from '../../src/services/mei-notas.service.js';
import { buildNfseEmitRpsPayload } from '../../src/services/plugnotas/plugnotas-empresa-rps-inicial.js';
import { consultarNfse, emitirNfse } from '../../src/services/plugnotas/nfse.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const readArg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const manterAliquota = process.argv.includes('--com-aliquota');

const input = {
  prestadorCpfCnpj: '60511506000197',
  prestadorRazaoSocial: 'CF CARNEIRO CONTABILIDADE LTDA',
  prestadorEndereco: {
    codigoCidade: '3543402',
    descricaoCidade: 'RIBEIRAO PRETO',
    estado: 'SP',
    cep: '14092210',
    logradouro: 'R DOUTOR ANTONIO CARLOS TINOCO',
    numero: '780',
    bairro: 'JARDIM ANHANGUERA',
  },
  tomadorCpfCnpj: '54843054000148',
  tomadorRazaoSocial: 'PP ELETRONICA E ACESSORIOS LTDA',
  tomadorEndereco: {
    codigoCidade: '3519600',
    descricaoCidade: 'IBITINGA',
    estado: 'SP',
    cep: '14940079',
    logradouro: 'R ANTONIO GARIBALDI BOLOCHINI DE PAULA',
    numero: '66',
    bairro: 'CENTRO',
  },
  servicos: [{
    codigo: '171901',
    cnae: '6920601',
    codigoNbs: '113022100',
    discriminacao: 'Atividades de contabilidade',
    valorServico: 0.05,
    codigoTributacao: '171901',
  }],
};

const payload = buildNfseEmitPayloadPreview(input, 'e2e-test', {
  codigoIbge: '3543402',
  nfseNacional: false,
  simplesNacional: true,
});

payload.rps = buildNfseEmitRpsPayload({
  lote: Number.parseInt(String(readArg('lote', '1')), 10),
  serie: String(readArg('serie', '1')),
  numero: Number.parseInt(String(readArg('numero', '81')), 10),
});

const iss = payload.servico?.[0]?.iss;
const aliquotaMontada = iss?.aliquota;
if (!manterAliquota && iss && 'aliquota' in iss) delete iss.aliquota;

const idIntegracao = `cf-e0712-test-${Date.now()}`;
console.log('Variável do teste:', manterAliquota ? 'MANTÉM iss.aliquota' : 'REMOVE iss.aliquota');
console.log('Payload crítico (pré-POST):');
console.log(JSON.stringify({
  idIntegracao,
  rps: payload.rps,
  versao: payload.versao,
  versaoEsquema: payload.versaoEsquema,
  regimeApuracaoTributaria: payload.regimeApuracaoTributaria,
  naturezaTributacao: payload.naturezaTributacao,
  codigo: payload.servico?.[0]?.codigo,
  codigoTributacao: payload.servico?.[0]?.codigoTributacao,
  codigoNbs: payload.servico?.[0]?.codigoNbs,
  aliquotaQueSeriaEnviada: aliquotaMontada ?? null,
  iss: payload.servico?.[0]?.iss,
  tributacao: payload.servico?.[0]?.ibscbs?.valores?.tributacao,
  cIndOp: payload.servico?.[0]?.ibscbs?.codigoOperacao,
}, null, 2));

if (String(process.env.ALLOW_PROD_NFSE_EMIT || '').trim() !== '1') {
  console.error('\nEmissão real bloqueada. Defina ALLOW_PROD_NFSE_EMIT=1 para emitir.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickStatus = (body) => {
  const doc = body?.documents?.[0] ?? body;
  return {
    status: doc?.status ?? body?.status,
    situacao: doc?.retorno?.situacao ?? doc?.situacao ?? body?.retorno?.situacao,
    mensagem: doc?.retorno?.mensagemRetorno ?? doc?.mensagemRetorno ?? body?.mensagem,
    id: doc?.id ?? body?.id,
    numeroNfse: doc?.numeroNfse ?? body?.numeroNfse,
  };
};

console.log('\nEmitindo na PlugNotas...');
let emitResp;
try {
  emitResp = await emitirNfse({ ...payload, idIntegracao });
} catch (err) {
  console.error('Falha POST:', err?.message ?? err);
  process.exit(1);
}

const notaId = (emitResp?.documents?.[0] ?? emitResp)?.id;
console.log('Resposta imediata:', JSON.stringify(pickStatus(emitResp), null, 2));
if (!notaId) process.exit(1);

console.log('\nAguardando status terminal...');
for (let i = 0; i < 24; i += 1) {
  await sleep(5000);
  const body = await consultarNfse(notaId);
  const s = pickStatus(body);
  const st = String(s.status ?? s.situacao ?? '').toLowerCase();
  console.log(`[${i + 1}]`, s.status ?? s.situacao, (s.mensagem ?? '').slice(0, 160));
  if (['autoriz', 'conclu', 'rejeit', 'cancel'].some((x) => st.includes(x))) {
    console.log('\n--- Resultado final ---');
    console.log(JSON.stringify({ ...s, notaId }, null, 2));
    process.exit(st.includes('rejeit') ? 2 : 0);
  }
}
console.error('Timeout. Consulte id=', notaId);
process.exit(3);

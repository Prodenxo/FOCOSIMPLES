/**
 * Teste one-shot: Gesso & Cia 070602 Ribeirão — emite e aguarda status terminal.
 * Uso: ALLOW_PROD_NFSE_EMIT=1 node scripts/one-time/gesso-nfse-070602-emit-test.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../src/config/env.js';
import { buildNfseEmitPayloadPreview } from '../../src/services/mei-notas.service.js';
import { buildNfseEmitRpsPayload } from '../../src/services/plugnotas/plugnotas-empresa-rps-inicial.js';
import { emitirNfse } from '../../src/services/plugnotas/nfse.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const PRESTADOR = '68185664000106';
const TOMADOR = '60511506000197';

const tomadorEndereco = {
  codigoCidade: '3543402',
  descricaoCidade: 'RIBEIRAO PRETO',
  estado: 'SP',
  cep: '14092210',
  logradouro: 'R DOUTOR ANTONIO CARLOS TINOCO',
  numero: '780',
  bairro: 'JARDIM ANHANGUERA',
};

const input = {
  prestadorCpfCnpj: PRESTADOR,
  prestadorRazaoSocial: 'GESSO & CIA SILVA LTDA',
  prestadorEndereco: {
    codigoCidade: '3543402',
    descricaoCidade: 'RIBEIRAO PRETO',
    estado: 'SP',
    cep: '14092050',
    logradouro: 'RUA CORONEL MARIANO DE MELO',
    numero: '0',
    bairro: 'JARDIM ANHANGUERA',
  },
  tomadorCpfCnpj: TOMADOR,
  tomadorRazaoSocial: 'CF CARNEIRO CONTABILIDADE LTDA',
  tomadorEndereco,
  servicos: [{
    codigo: '070602',
    cnae: '4330403',
    codigoNbs: '101072000',
    cIndOp: '020201',
    discriminacao: 'Teste automatizado Foco Simples — gesso 070602',
    valorServico: 0.01,
    aliquota: 2,
    codigoTributacao: '001',
    obra: { usarEnderecoTomador: true },
  }],
};

const idIntegracao = `gesso-e2e-test-${Date.now()}`;
const payload = buildNfseEmitPayloadPreview(input, 'e2e-test', {
  codigoIbge: '3543402',
  nfseNacional: false,
  simplesNacional: true,
});

const readArg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
payload.rps = buildNfseEmitRpsPayload({
  lote: Number.parseInt(String(readArg('lote', '1')), 10),
  serie: String(readArg('serie', '1')),
  numero: Number.parseInt(String(readArg('numero', '30')), 10),
});

console.log('Payload crítico (pré-POST):');
console.log(JSON.stringify({
  idIntegracao,
  rps: payload.rps,
  versao: payload.versao,
  versaoEsquema: payload.versaoEsquema,
  cidadePrestacao: payload.cidadePrestacao,
  obraEndereco: payload.servico?.[0]?.obra?.endereco ?? null,
  ibscbs: payload.servico?.[0]?.ibscbs,
}, null, 2));

const pickStatus = (body) => {
  const doc = Array.isArray(body) ? body[0] : (body?.documents?.[0] ?? body);
  return {
    status: doc?.status ?? body?.status,
    situacao: doc?.retorno?.situacao ?? doc?.situacao ?? body?.retorno?.situacao,
    mensagem: doc?.retorno?.mensagemRetorno ?? doc?.mensagemRetorno ?? doc?.error?.mensagem ?? body?.mensagem,
    id: doc?.id ?? body?.id,
    numeroNfse: doc?.numeroNfse ?? body?.numeroNfse,
    rps: doc?.rps,
    protocol: doc?.protocol ?? body?.protocol,
  };
};

const consultarComTimeout = async (id) => {
  const res = await fetch(`https://api.plugnotas.com.br/nfse/${id}`, {
    headers: { Accept: 'application/json', 'x-api-key': env.PLUGNOTAS_API_KEY },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Consulta HTTP ${res.status}`);
  return res.json();
};

if (String(process.env.ALLOW_PROD_NFSE_EMIT || '').trim() !== '1') {
  console.error('Emissão real bloqueada. Defina ALLOW_PROD_NFSE_EMIT=1.');
  process.exit(1);
}

console.log('\nEmitindo na PlugNotas...');
let emitResp;
try {
  emitResp = await emitirNfse({ ...payload, idIntegracao });
} catch (err) {
  console.error('Falha POST:', err?.message ?? err);
  process.exit(1);
}

const doc0 = emitResp?.documents?.[0] ?? emitResp;
const notaId = doc0?.id;
console.log('Resposta imediata:', JSON.stringify(pickStatus(emitResp), null, 2));
if (!notaId) {
  console.log('Sem id na resposta:', JSON.stringify(emitResp, null, 2));
  process.exit(1);
}

console.log('\nAguardando status terminal (até ~3 min)...');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 18; i += 1) {
  await sleep(10_000);
  let body;
  try {
    body = await consultarComTimeout(notaId);
  } catch (err) {
    console.log(`[${i + 1}] consulta falhou:`, err?.message ?? err);
    continue;
  }
  const s = pickStatus(body);
  console.log(`[${i + 1}]`, s.status ?? s.situacao, s.mensagem?.slice?.(0, 160) ?? '');
  const st = String(s.status ?? s.situacao ?? '').toLowerCase();
  if (['concluido', 'concluído', 'autorizado', 'autorizada', 'rejeitado', 'rejeitada', 'cancelado'].some((x) => st.includes(x.replace('í', 'i')))) {
    console.log('\n--- Resultado final ---');
    console.log(JSON.stringify(s, null, 2));
    process.exit(st.includes('rejeit') ? 2 : 0);
  }
}
console.error('Timeout aguardando conclusão. Consulte manualmente id=', notaId);
process.exit(3);

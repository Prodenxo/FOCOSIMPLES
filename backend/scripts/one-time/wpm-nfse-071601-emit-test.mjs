/**
 * Teste one-shot: WPM 071601 Ribeirão — emite e aguarda status terminal na PlugNotas.
 * Uso: node scripts/one-time/wpm-nfse-071601-emit-test.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNfseEmitPayloadPreview } from '../../src/services/mei-notas.service.js';
import { buildNfseEmitRpsPayload } from '../../src/services/plugnotas/plugnotas-empresa-rps-inicial.js';
import { consultarNfse, emitirNfse } from '../../src/services/plugnotas/nfse.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const PRESTADOR = '68303090000123';
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
  prestadorRazaoSocial: 'WPM SERVICOS DE LOCACOES E TERRAPLANAGEM LTDA',
  prestadorEndereco: {
    codigoCidade: '3543402',
    descricaoCidade: 'RIBEIRAO PRETO',
    estado: 'SP',
    cep: '14092200',
    logradouro: 'JOSE DE MAGALHAES',
    numero: '860',
    bairro: 'JARDIM ANHANGUERA',
  },
  tomadorCpfCnpj: TOMADOR,
  tomadorRazaoSocial: 'CF CARNEIRO CONTABILIDADE LTDA',
  tomadorEndereco,
  servicos: [{
    codigo: '071601',
    cnae: '4222701',
    codigoNbs: '119011000',
    discriminacao: 'Teste automatizado Foco Simples - redes 071601',
    valorServico: 0.01,
    aliquota: 2,
    // cTribMun do cadastro ISS.net da empresa (contador) — sem isto a prefeitura devolve EPM70.
    codigoTributacao: '71602',
  }],
};

const idIntegracao = `wpm-e2e-test-${Date.now()}`;
const payload = buildNfseEmitPayloadPreview(input, 'e2e-test', {
  codigoIbge: '3543402',
  nfseNacional: false,
  simplesNacional: true,
});

// RPS explícito: a empresa tem mais de uma série em `numeracao` e a escolha automática
// pode cair num número já consumido (E0014), escondendo a resposta real da prefeitura.
const readArg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
payload.rps = buildNfseEmitRpsPayload({
  lote: Number.parseInt(String(readArg('lote', '1')), 10),
  serie: String(readArg('serie', '70000')),
  numero: Number.parseInt(String(readArg('numero', '23')), 10),
});

const critical = {
  idIntegracao,
  rps: payload.rps,
  versao: payload.versao,
  versaoEsquema: payload.versaoEsquema,
  cidadePrestacao: payload.cidadePrestacao,
  obraEndereco: payload.servico?.[0]?.obra?.endereco ?? null,
  ibscbs: payload.servico?.[0]?.ibscbs,
  discriminacao: payload.servico?.[0]?.discriminacao,
};

console.log('Payload crítico (pré-POST):');
console.log(JSON.stringify(critical, null, 2));

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

if (String(process.env.ALLOW_PROD_NFSE_EMIT || '').trim() !== '1') {
  console.error(
    'Emissão real bloqueada. Defina ALLOW_PROD_NFSE_EMIT=1 apenas se você aceitar nota em produção.',
  );
  process.exit(1);
}

console.log('\nEmitindo na PlugNotas (produção se empresa estiver em produção)...');
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

console.log('\nAguardando status terminal (até ~2 min)...');
for (let i = 0; i < 24; i += 1) {
  await sleep(5000);
  const body = await consultarNfse(notaId);
  const s = pickStatus(body);
  console.log(`[${i + 1}]`, s.status ?? s.situacao, s.mensagem?.slice(0, 120) ?? '');
  const st = String(s.status ?? s.situacao ?? '').toLowerCase();
  if (['concluido', 'concluído', 'autorizado', 'autorizada', 'rejeitado', 'rejeitada', 'cancelado'].some((x) => st.includes(x.replace('í', 'i')))) {
    console.log('\n--- Resultado final ---');
    console.log(JSON.stringify(s, null, 2));
    const msg = String(s.mensagem || '');
    if (st.includes('rejeit') || msg.includes('E160')) {
      console.log('\nConsulta cidadePrestacao/obra na nota:');
      console.log(JSON.stringify({
        cidadePrestacao: body?.cidadePrestacao,
        obra: body?.servico?.[0]?.obra,
        versaoEsquema: body?.versaoEsquema,
      }, null, 2));
      process.exit(2);
    }
    if (s.numeroNfse) {
      console.log('\nSUCESSO — número NFS-e:', s.numeroNfse);
      process.exit(0);
    }
    process.exit(st.includes('rejeit') ? 2 : 0);
  }
}
console.error('Timeout aguardando conclusão. Consulte manualmente id=', notaId);
process.exit(3);

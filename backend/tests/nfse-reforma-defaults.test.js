import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  hasCompleteServicoIbscbs,
  NFSE_CINDOP_OBRA_NO_LOCAL,
  NFSE_CINDOP_SERVICO_GERAL,
  NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  NFSE_FIN_NFSE_REGULAR,
  NFSE_VERSAO_ESQUEMA_RTC,
  NFSE_VERSAO_ESQUEMA_RTC007,
  NFSE_VERSAO_LAYOUT_NACIONAL,
  readCodigoIbgeFromEmpresa,
  requiresIssnetRtcEmitSchema,
  resolveCodigoTributacaoIssnetFromAliquota,
  resolveCIndOpForServico,
  resolveFinNfseValue,
  sanitizeIbscbsForPlugnotasEmit,
  stripIncompleteServicoIbscbsFromEmitPayload,
  stripPlugnotasInvalidServicoReformaFields,
  validateNfseCatalogProdutoMetadata,
} from '../src/services/nfse-reforma-defaults.js';
import { SIMPLES_NACIONAL_NFE_INF_CPL_LINES } from '../src/lib/simples-nacional-nfe-infcpl.js';
import { assembleNfsePlugnotasEmitPayload } from '../src/services/nfse-emit-payload-assembler.js';

test('resolveFinNfseValue: default 0 (regular)', () => {
  assert.equal(resolveFinNfseValue({}), NFSE_FIN_NFSE_REGULAR);
  assert.equal(resolveFinNfseValue({ finNFSe: 1 }), 1);
});

test('resolveCIndOpForServico: oficina / LC 14.01 → 050101', () => {
  assert.equal(
    resolveCIndOpForServico({ codigo: '140101', cnae: '4520001' }),
    NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  );
  assert.equal(
    resolveCIndOpForServico({ codigo: '14.01.01' }),
    NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  );
});

test('requiresIssnetRtcEmitSchema: Ribeirão Preto', () => {
  assert.equal(requiresIssnetRtcEmitSchema('3543402'), true);
  assert.equal(requiresIssnetRtcEmitSchema('3550308'), false);
});

test('readCodigoIbgeFromEmpresa: prefeitura.config', () => {
  assert.equal(
    readCodigoIbgeFromEmpresa({ nfse: { config: { prefeitura: { codigoIbge: '3543402' } } } }),
    '3543402',
  );
});

test('sanitizeIbscbsForPlugnotasEmit: remove indicadorOperacao inválido', () => {
  const out = sanitizeIbscbsForPlugnotasEmit({
    finalidadeNFSe: 0,
    operacaoPessoal: 0,
    codigoOperacao: '020201',
    indicadorOperacao: '020201',
    valores: { tributacao: { cst: '000', cct: '000001' } },
  });
  assert.equal(out.indicadorOperacao, undefined);
  assert.equal(out.codigoOperacao, '020201');
});

test('stripPlugnotasInvalidServicoReformaFields: limpa servico raiz e ibscbs', () => {
  const out = stripPlugnotasInvalidServicoReformaFields({
    servico: [{
      codigo: '071601',
      cIndOp: '020201',
      codigoOperacao: '020201',
      ibscbs: {
        codigoOperacao: '020201',
        indicadorOperacao: 20201,
        finalidadeNFSe: 0,
        operacaoPessoal: 0,
        valores: { tributacao: { cst: '000', cct: '000001' } },
      },
    }],
  });
  assert.equal(out.servico[0].codigoOperacao, undefined);
  assert.equal(out.servico[0].cIndOp, '020201');
  assert.equal(out.servico[0].ibscbs.indicadorOperacao, undefined);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '020201');
});

test('buildMinimalServicoIbscbs: formato PlugNotas com valores.tributacao e indDest', () => {
  const ibscbs = buildMinimalServicoIbscbs({}, {
    finNFSe: 0,
    servico: { codigo: '140101' },
    cIndOp: '050101',
    simplesNacional: true,
  });

  assert.equal(ibscbs.finalidadeNFSe, 0);
  assert.equal(ibscbs.codigoOperacao, '050101');
  assert.equal(ibscbs.indicadorOperacao, undefined);
  assert.equal(ibscbs.valores.tributacao.cst, '000');
  assert.equal(ibscbs.valores.tributacao.cct, '000001');
  assert.equal(ibscbs.destinatario.indicador, 0);
});

test('resolveCodigoTributacaoIssnetFromAliquota: tabela ISSNET conhecida', () => {
  assert.equal(resolveCodigoTributacaoIssnetFromAliquota(2), '001');
  assert.equal(resolveCodigoTributacaoIssnetFromAliquota(5), '006');
  assert.equal(resolveCodigoTributacaoIssnetFromAliquota(0), null);
  assert.equal(resolveCodigoTributacaoIssnetFromAliquota(null), null);
  assert.equal(resolveCodigoTributacaoIssnetFromAliquota(4), null);
});

test('enrichNfseReformaCabecalhoInEmitPayload: alíquota 0 não força codigoTributacao', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '070602', iss: { aliquota: 0 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].codigoTributacao, undefined);
});

test('enrichNfseReformaCabecalhoInEmitPayload: obra 07.xx usa cIndOp 020201', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '070602', cnae: '4330403', iss: { aliquota: 0 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '020201');
  assert.equal(out.servico[0].ibscbs.indicadorOperacao, undefined);
});

test('enrichNfseReformaCabecalhoInEmitPayload: obra 07.xx sem municipioIncidenciaIbsCbs duplicado', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{
      codigo: '070602',
      codigoCidadeIncidencia: '3543402',
      iss: { aliquota: 2 },
    }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].ibscbs.municipioIncidenciaIbsCbs, undefined);
  assert.equal(out.servico[0].codigoCidadeIncidencia, '3543402');
});

test('resolveCIndOpForServico: 071601 não é obra — cIndOp geral (EM042/E0932)', () => {
  assert.equal(resolveCIndOpForServico({ codigo: '071601', cnae: '4222701' }), NFSE_CINDOP_SERVICO_GERAL);
  assert.equal(resolveCIndOpForServico({ codigo: '070602', cnae: '4330403' }), NFSE_CINDOP_OBRA_NO_LOCAL);
});

test('enrichNfseReformaCabecalhoInEmitPayload: ISSNET não adivinha codigoTributacao pela alíquota (EPM70)', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '070602', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].codigoTributacao, undefined);
});

test('enrichNfseReformaCabecalhoInEmitPayload: ISSNET preserva codigoTributacao de 5 dígitos do cadastro', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '071601', codigoTributacao: '71602', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].codigoTributacao, '71602');
});

test('enrichNfseReformaCabecalhoInEmitPayload: ISSNETONLINE30 Ribeirão Preto', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001', codigoTributacao: '001', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.versao, NFSE_VERSAO_LAYOUT_NACIONAL);
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC007);
  assert.equal(out.emitente.codigoCidade, '3543402');
  assert.equal(out.naturezaTributacao, 1);
  assert.equal(out.servico[0].codigoTributacao, '001');
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cst, '000');
});

test('enrichNfseReformaCabecalhoInEmitPayload: flag NFSE_ISSNET_RTC_SCHEMA_DISABLED omite cabeçalho RTC e ibscbs', () => {
  const anterior = process.env.NFSE_ISSNET_RTC_SCHEMA_DISABLED;
  process.env.NFSE_ISSNET_RTC_SCHEMA_DISABLED = 'true';
  try {
    const input = { servico: [{ codigo: '140101', cnae: '4520001', iss: { aliquota: 2 } }] };
    const out = enrichNfseReformaCabecalhoInEmitPayload(input, {
      simplesNacional: true,
      nfseNacional: false,
      codigoIbge: '3543402',
    });
    assert.deepEqual(out, input);
    assert.equal(out.versaoEsquema, undefined);
    assert.equal(out.servico[0].ibscbs, undefined);
  } finally {
    if (anterior === undefined) delete process.env.NFSE_ISSNET_RTC_SCHEMA_DISABLED;
    else process.env.NFSE_ISSNET_RTC_SCHEMA_DISABLED = anterior;
  }
});

test('enrichNfseReformaCabecalhoInEmitPayload: NFSE_ISSNET_RTC_VERSAO_ESQUEMA=RTC ignora e usa RTC007', () => {
  const anterior = process.env.NFSE_ISSNET_RTC_VERSAO_ESQUEMA;
  process.env.NFSE_ISSNET_RTC_VERSAO_ESQUEMA = NFSE_VERSAO_ESQUEMA_RTC;
  try {
    const out = enrichNfseReformaCabecalhoInEmitPayload({
      servico: [{ codigo: '140101', cnae: '4520001', iss: { aliquota: 2 } }],
    }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
    assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC007);
    assert.equal(out.versao, NFSE_VERSAO_LAYOUT_NACIONAL);
    assert.equal(out.servico[0].ibscbs.valores.tributacao.cst, '000');
  } finally {
    if (anterior === undefined) delete process.env.NFSE_ISSNET_RTC_VERSAO_ESQUEMA;
    else process.env.NFSE_ISSNET_RTC_VERSAO_ESQUEMA = anterior;
  }
});

test('enrichNfseReformaCabecalhoInEmitPayload: ignora cidades fora do ISSNET RTC', () => {
  const input = { servico: [{ codigo: '140101' }], versao: '2' };
  const out = enrichNfseReformaCabecalhoInEmitPayload(input, { codigoIbge: '3550308' });
  assert.deepEqual(out, input);
});

test('enrichNfseReformaCabecalhoInEmitPayload: cIndOp vira codigoOperacao em ibscbs', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    idIntegracao: 'teste',
    servico: [{ codigo: '140101', cnae: '4520001' }],
  }, { codigoIbge: '3543402', nfseNacional: true });
  assert.equal(out.servico[0].ibscbs.codigoOperacao, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
});

test('validateNfseCatalogProdutoMetadata: aceita cIndOp válido', () => {
  assert.doesNotThrow(() => validateNfseCatalogProdutoMetadata({ cIndOp: '050101' }));
});

test('stripIncompleteServicoIbscbsFromEmitPayload: remove ibscbs parcial', () => {
  const out = stripIncompleteServicoIbscbsFromEmitPayload({
    servico: [{ codigo: '171901', ibscbs: { codigoOperacao: '160201' } }],
  });
  assert.equal(out.servico[0].ibscbs, undefined);
  assert.equal(out.servico[0].codigo, '171901');
});

test('hasCompleteServicoIbscbs: detecta ibscbs montado', () => {
  const complete = buildMinimalServicoIbscbs({}, { servico: { codigo: '140101' } });
  assert.equal(hasCompleteServicoIbscbs(complete), true);
  assert.equal(hasCompleteServicoIbscbs({ codigoOperacao: '160201' }), false);
});

test('assembleNfsePlugnotasEmitPayload: cIndOp no serviço vira ibscbs completo em Ribeirão Preto', () => {
  const out = assembleNfsePlugnotasEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    servico: [{
      codigo: '171901',
      cnae: '9511800',
      codigoNbs: '120013110',
      cIndOp: '160201',
      codigoTributacao: '001',
      iss: { aliquota: 2 },
    }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(hasCompleteServicoIbscbs(out.servico[0].ibscbs), true);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '160201');
  assert.equal(out.servico[0].ibscbs.indicadorOperacao, undefined);
});

test('assembleNfsePlugnotasEmitPayload: inclui frases do Simples em informacoesComplementares', () => {
  const out = assembleNfsePlugnotasEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    servico: [{
      codigo: '140101',
      codigoNbs: '120013110',
      cIndOp: '050101',
      codigoTributacao: '001',
      iss: { aliquota: 2 },
    }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.informacoesComplementares, SIMPLES_NACIONAL_NFE_INF_CPL_LINES.join('|'));
});

test('assembleNfsePlugnotasEmitPayload: obra 070602 ISSNET usa RTC007 e só cidadePrestacao', () => {
  const out = assembleNfsePlugnotasEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402', cep: '14092200', logradouro: 'JOSE DE MAGALHAES', numero: '860', bairro: 'JARDIM ANHANGUERA', estado: 'SP' } },
    tomador: {
      endereco: {
        codigoCidade: '3543402',
        descricaoCidade: 'RIBEIRAO PRETO',
        estado: 'SP',
        cep: '14092210',
        logradouro: 'R DOUTOR ANTONIO CARLOS TINOCO',
        numero: '780',
        bairro: 'JARDIM ANHANGUERA',
        codigoPais: '1058',
        descricaoPais: 'Brasil',
      },
    },
    servico: [{
      codigo: '070602',
      codigoNbs: '101072000',
      cnae: '4330403',
      cIndOp: '020201',
      codigoTributacao: '70602',
      iss: { aliquota: 2 },
    }],
  }, {
    simplesNacional: true,
    nfseNacional: false,
    codigoIbge: '3543402',
    obraContext: { servicosInput: [{ codigo: '070602', obra: { usarEnderecoTomador: true } }] },
  });
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC007);
  assert.equal(out.cidadePrestacao?.logradouro, 'R DOUTOR ANTONIO CARLOS TINOCO');
  assert.equal(out.cidadePrestacao?.tipoLogradouro, undefined);
  assert.equal(out.cidadePrestacao?.estado, undefined);
  assert.equal(out.servico[0].codigoTributacao, '70602');
  assert.equal(out.servico[0].tributosFederaisRetidos, false);
  assert.equal(out.servico[0].obra?.endereco, undefined);
});

test('assembleNfsePlugnotasEmitPayload: não envia indicadorOperacao (PlugNotas)', () => {
  const out = assembleNfsePlugnotasEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    tomador: { endereco: { codigoCidade: '3543402', cep: '14092210', logradouro: 'Rua', numero: '1', bairro: 'Centro' } },
    servico: [{
      codigo: '071601',
      codigoNbs: '119011000',
      cIndOp: '020201',
      codigoOperacao: '020201',
      codigoTributacao: '71602',
      iss: { aliquota: 2 },
    }],
  }, {
    simplesNacional: true,
    nfseNacional: false,
    codigoIbge: '3543402',
    obraContext: { servicosInput: [{ codigo: '071601', obra: { usarEnderecoTomador: true } }] },
  });
  assert.equal(out.servico[0].codigoOperacao, undefined);
  assert.equal(out.servico[0].ibscbs?.indicadorOperacao, undefined);
  assert.equal(out.servico[0].ibscbs?.codigoOperacao, '020201');
});

test('enrichNfseReformaCabecalhoInEmitPayload: cIndOp locação repete endereço do tomador em ibscbs.imovel (E0932)', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    tomador: {
      cpfCnpj: '55974414000103',
      endereco: {
        cep: '14000000',
        logradouro: 'Rua Teste',
        numero: '100',
        bairro: 'Centro',
        codigoCidade: '3543402',
        descricaoCidade: 'Ribeirão Preto',
        estado: 'SP',
      },
    },
    servico: [{ codigo: '140101', cIndOp: '160201', iss: { aliquota: 2 } }],
  }, { codigoIbge: '3543402', simplesNacional: true });
  assert.equal(out.servico[0].ibscbs.imovel?.endereco?.logradouro, 'Rua Teste');
  assert.equal(out.servico[0].ibscbs.imovel?.endereco?.numero, '100');
});

test('enrichNfseReformaCabecalhoInEmitPayload: cIndOp geral 100301 não inclui imovel', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    prestador: { endereco: { codigoCidade: '3543402' } },
    tomador: { endereco: { cep: '14000000', logradouro: 'Rua X', numero: '1', bairro: 'Centro' } },
    servico: [{ codigo: '140101', cIndOp: '100301', iss: { aliquota: 2 } }],
  }, { codigoIbge: '3543402', simplesNacional: true });
  assert.equal(out.servico[0].ibscbs.imovel, undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  hasCompleteServicoIbscbs,
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
  stripIncompleteServicoIbscbsFromEmitPayload,
  validateNfseCatalogProdutoMetadata,
} from '../src/services/nfse-reforma-defaults.js';
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

test('buildMinimalServicoIbscbs: formato PlugNotas com valores.tributacao e indDest', () => {
  const ibscbs = buildMinimalServicoIbscbs({}, {
    finNFSe: 0,
    servico: { codigo: '140101' },
    cIndOp: '050101',
    simplesNacional: true,
  });

  assert.equal(ibscbs.finalidadeNFSe, 0);
  assert.equal(ibscbs.codigoOperacao, '050101');
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

test('enrichNfseReformaCabecalhoInEmitPayload: obra 07.xx não infere codigoTributacao pela alíquota', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '070602', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.servico[0].codigoTributacao, undefined);
});

test('enrichNfseReformaCabecalhoInEmitPayload: ISSNETONLINE30 Ribeirão Preto', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.versao, NFSE_VERSAO_LAYOUT_NACIONAL);
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC007);
  assert.equal(out.emitente.codigoCidade, '3543402');
  assert.equal(out.naturezaTributacao, 1);
  assert.equal(out.servico[0].codigoTributacao, '001');
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cst, '000');
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
    servico: [{ codigo: '171901', cnae: '9511800', cIndOp: '160201', iss: { aliquota: 2 } }],
  }, { simplesNacional: true, nfseNacional: false });
  assert.equal(hasCompleteServicoIbscbs(out.servico[0].ibscbs), true);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '160201');
});

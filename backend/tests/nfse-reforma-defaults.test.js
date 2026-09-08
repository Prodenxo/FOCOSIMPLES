import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  NFSE_CINDOP_SERVICO_GERAL,
  NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  NFSE_FIN_NFSE_REGULAR,
  NFSE_VERSAO_ESQUEMA_RTC,
  NFSE_VERSAO_LAYOUT_NACIONAL,
  readCodigoIbgeFromEmpresa,
  requiresIssnetRtcEmitSchema,
  resolveCIndOpForServico,
  resolveFinNfseValue,
  validateNfseCatalogProdutoMetadata,
} from '../src/services/nfse-reforma-defaults.js';

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

test('enrichNfseReformaCabecalhoInEmitPayload: versao 1.01 + RTC + emitente nacional', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001' }],
  }, { simplesNacional: true, nfseNacional: true, codigoIbge: '3543402' });
  assert.equal(out.versao, NFSE_VERSAO_LAYOUT_NACIONAL);
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC);
  assert.equal(out.emitente.codigoCidade, '3543402');
  assert.equal(out.servico[0].ibscbs.destinatario.indicador, 0);
});

test('enrichNfseReformaCabecalhoInEmitPayload: municipal ISSNET RTC sem versao 1.01', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001' }],
  }, { simplesNacional: true, nfseNacional: false, codigoIbge: '3543402' });
  assert.equal(out.versao, undefined);
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC);
  assert.equal(out.emitente, undefined);
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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  NFSE_CINDOP_SERVICO_GERAL,
  NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  NFSE_FIN_NFSE_REGULAR,
  NFSE_VERSAO_ESQUEMA_RTC,
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

test('resolveCIndOpForServico: serviço genérico → 100301', () => {
  assert.equal(
    resolveCIndOpForServico({ codigo: '170601', cnae: '7319002' }),
    NFSE_CINDOP_SERVICO_GERAL,
  );
});

test('resolveCIndOpForServico: respeita valor explícito', () => {
  assert.equal(
    resolveCIndOpForServico({ ibscbs: { cIndOp: '050102' } }),
    '050102',
  );
});

test('buildMinimalServicoIbscbs: formato PlugNotas com valores.tributacao', () => {
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
  assert.equal(ibscbs.regApIBSCBSSN, undefined);
  assert.equal(ibscbs.finNFSe, undefined);
  assert.equal(ibscbs.destinatario, undefined);
});

test('buildMinimalServicoIbscbs: ignora cst inválido no input', () => {
  const ibscbs = buildMinimalServicoIbscbs({ cst: 'x' }, { servico: { codigo: '140101' } });
  assert.equal(ibscbs.valores.tributacao.cst, '000');
});

test('enrichNfseReformaCabecalhoInEmitPayload: versaoEsquema RTC + ibscbs limpo', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001' }],
  }, { simplesNacional: true });
  assert.equal(out.versaoEsquema, NFSE_VERSAO_ESQUEMA_RTC);
  assert.equal(out.ibscbs, undefined);
  assert.equal(out.finNFSe, undefined);
  assert.equal(out.servico[0].situacaoTributariaIbsCbs, undefined);
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cst, '000');
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cct, '000001');
  assert.equal(out.servico[0].ibscbs.codigoOperacao, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
});

test('buildMinimalServicoIbscbs: preserva valores.tributacao existentes', () => {
  const ibscbs = buildMinimalServicoIbscbs({
    valores: {
      operacao: { documentosReferenciados: [] },
      tributacao: { codigoCreditoPresumido: '10' },
    },
  }, { servico: { codigo: '140101' } });
  assert.equal(ibscbs.valores.tributacao.cst, '000');
  assert.equal(ibscbs.valores.tributacao.cct, '000001');
  assert.equal(ibscbs.valores.tributacao.codigoCreditoPresumido, '10');
  assert.ok(Array.isArray(ibscbs.valores.operacao.documentosReferenciados));
});

test('enrichNfseReformaCabecalhoInEmitPayload: cIndOp vira codigoOperacao em ibscbs', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    idIntegracao: 'teste',
    servico: [{ codigo: '140101', cnae: '4520001' }],
  });
  assert.equal(out.cIndOp, undefined);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
});

test('validateNfseCatalogProdutoMetadata: rejeita NBS inválido', () => {
  assert.throws(
    () => validateNfseCatalogProdutoMetadata({ codigoNbs: '123' }),
    /NBS/,
  );
});

test('validateNfseCatalogProdutoMetadata: aceita cIndOp válido', () => {
  assert.doesNotThrow(() => validateNfseCatalogProdutoMetadata({ cIndOp: '050101' }));
});

test('enrichNfseReformaCabecalhoInEmitPayload: preserva codigoOperacao explícito', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{
      codigo: '140101',
      ibscbs: { codigoOperacao: '050102', finalidadeNFSe: 0 },
    }],
  });
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '050102');
});

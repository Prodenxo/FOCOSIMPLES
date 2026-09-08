import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  NFSE_CINDOP_SERVICO_GERAL,
  NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO,
  NFSE_FIN_NFSE_REGULAR,
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

test('buildMinimalServicoIbscbs: finNFSe + cIndOp + CST + classificação + SN', () => {
  const ibscbs = buildMinimalServicoIbscbs({}, {
    finNFSe: 0,
    servico: { codigo: '140101' },
    cIndOp: '050101',
    simplesNacional: true,
  });

  assert.equal(ibscbs.finNFSe, 0);
  assert.equal(ibscbs.cIndOp, '050101');
  assert.equal(ibscbs.situacaoTributariaIbsCbs, '000');
  assert.equal(ibscbs.cst, '000');
  assert.equal(ibscbs.cstIbsCbs, '000');
  assert.equal(ibscbs.classificacaoTributariaIbsCbs, '000001');
  assert.equal(ibscbs.valores.tributacao.cst, '000');
  assert.equal(ibscbs.valores.tributacao.cct, '000001');
  assert.equal(ibscbs.regApIBSCBSSN, 1);
  assert.equal(ibscbs.destinatario.indicador, 0);
});

test('buildMinimalServicoIbscbs: ignora cst inválido no input', () => {
  const ibscbs = buildMinimalServicoIbscbs({ cst: 'x' }, { servico: { codigo: '140101' } });
  assert.equal(ibscbs.situacaoTributariaIbsCbs, '000');
});

test('enrichNfseReformaCabecalhoInEmitPayload: CST e classificação em servico[].ibscbs.valores.tributacao', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{ codigo: '140101', cnae: '4520001' }],
  }, { simplesNacional: true });
  assert.equal(out.servico[0].situacaoTributariaIbsCbs, '000');
  assert.equal(out.servico[0].ibscbs.situacaoTributariaIbsCbs, '000');
  assert.equal(out.servico[0].ibscbs.classificacaoTributariaIbsCbs, '000001');
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cst, '000');
  assert.equal(out.servico[0].ibscbs.valores.tributacao.cct, '000001');
  assert.equal(out.servico[0].ibscbs.regApIBSCBSSN, 1);
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

test('enrichNfseReformaCabecalhoInEmitPayload: cIndOp em servico[].ibscbs', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    idIntegracao: 'teste',
    servico: [{ codigo: '140101', cnae: '4520001' }],
  });
  assert.equal(out.cIndOp, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
  assert.equal(out.servico[0].ibscbs.cIndOp, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
  assert.equal(out.ibscbs.cIndOp, NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO);
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

test('enrichNfseReformaCabecalhoInEmitPayload: preserva cIndOp explícito', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    servico: [{
      codigo: '140101',
      ibscbs: { codigoOperacao: '050102', finNFSe: 0 },
    }],
  });
  assert.equal(out.servico[0].ibscbs.cIndOp, '050102');
});

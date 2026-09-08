import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMinimalServicoIbscbs,
  enrichNfseReformaCabecalhoInEmitPayload,
  NFSE_FIN_NFSE_REGULAR,
  resolveFinNfseValue,
} from '../src/services/nfse-reforma-defaults.js';

test('resolveFinNfseValue: default 0 (regular)', () => {
  assert.equal(resolveFinNfseValue({}), NFSE_FIN_NFSE_REGULAR);
  assert.equal(resolveFinNfseValue({ finNFSe: 1 }), 1);
  assert.equal(resolveFinNfseValue({ finalidadeNFSe: 2 }), 2);
});

test('buildMinimalServicoIbscbs: finNFSe + operacaoPessoal', () => {
  const ibscbs = buildMinimalServicoIbscbs({}, { finNFSe: 0, operacaoPessoal: 0 });
  assert.equal(ibscbs.finNFSe, 0);
  assert.equal(ibscbs.finalidadeNFSe, 0);
  assert.equal(ibscbs.operacaoPessoal, 0);
  assert.equal(ibscbs.indFinal, 0);
});

test('enrichNfseReformaCabecalhoInEmitPayload: finNFSe em servico[].ibscbs (PlugNotas)', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    idIntegracao: 'teste',
    servico: [{ codigo: '140101' }, { codigo: '140102' }],
  });
  assert.equal(out.finNFSe, 0);
  assert.equal(out.ibscbs.finNFSe, 0);
  assert.equal(out.servico[0].ibscbs.finNFSe, 0);
  assert.equal(out.servico[0].ibscbs.finalidadeNFSe, 0);
  assert.equal(out.servico[0].ibscbs.operacaoPessoal, 0);
  assert.equal(out.servico[1].ibscbs.finNFSe, 0);
});

test('enrichNfseReformaCabecalhoInEmitPayload: preserva valores explícitos', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    finNFSe: 2,
    indFinal: 1,
    servico: [{
      codigo: '140101',
      ibscbs: { codigoOperacao: '100301', finNFSe: 1 },
    }],
  });
  assert.equal(out.finNFSe, 2);
  assert.equal(out.servico[0].ibscbs.finNFSe, 1);
  assert.equal(out.servico[0].ibscbs.codigoOperacao, '100301');
});

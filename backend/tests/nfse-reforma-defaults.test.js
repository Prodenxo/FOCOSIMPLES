import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichNfseReformaCabecalhoInEmitPayload,
  NFSE_FIN_NFSE_REGULAR,
  resolveFinNfseValue,
} from '../src/services/nfse-reforma-defaults.js';

test('resolveFinNfseValue: default 0 (regular)', () => {
  assert.equal(resolveFinNfseValue({}), NFSE_FIN_NFSE_REGULAR);
  assert.equal(resolveFinNfseValue({ finNFSe: 1 }), 1);
});

test('enrichNfseReformaCabecalhoInEmitPayload: finNFSe e ibscbs para ISSNET', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    idIntegracao: 'teste',
    servico: [{ codigo: '140101' }],
  });
  assert.equal(out.finNFSe, 0);
  assert.equal(out.indFinal, 0);
  assert.equal(out.ibscbs.finNFSe, 0);
  assert.equal(out.ibscbs.operacaoPessoal, 0);
});

test('enrichNfseReformaCabecalhoInEmitPayload: preserva valores explícitos', () => {
  const out = enrichNfseReformaCabecalhoInEmitPayload({
    finNFSe: 2,
    indFinal: 1,
    ibscbs: { codigoOperacao: '100301' },
  });
  assert.equal(out.finNFSe, 2);
  assert.equal(out.indFinal, 1);
  assert.equal(out.ibscbs.codigoOperacao, '100301');
  assert.equal(out.ibscbs.finNFSe, 2);
  assert.equal(out.ibscbs.operacaoPessoal, 1);
});

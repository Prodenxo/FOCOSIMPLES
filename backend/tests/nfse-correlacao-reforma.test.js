import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeCodigoTributacaoNacional,
  formatNfseCodigoNbsOptionsMessage,
  hasNfseCorrelacaoForCodigo,
  isNfseCodigoNbsValidoForCodigo,
  listNfseCodigoNbsOptionsForCodigo,
  listNfseCorrelacoesForCodigo,
  normalizeCodigoTributacaoNacionalKey,
  resolveNfseCorrelacaoReforma,
} from '../src/services/nfse-correlacao-reforma.js';

test('normalizeCodigoTributacaoNacionalKey: completa com zero à esquerda', () => {
  assert.equal(normalizeCodigoTributacaoNacionalKey('70201'), '070201');
  assert.equal(normalizeCodigoTributacaoNacionalKey('07.02.01'), '070201');
  assert.equal(normalizeCodigoTributacaoNacionalKey(''), '');
});

test('listNfseCorrelacoesForCodigo: obra 07.02.01 tem redução de bens imóveis', () => {
  const combos = listNfseCorrelacoesForCodigo('070201');
  assert.ok(combos.length > 0);
  assert.ok(combos.every((item) => item.cIndOp === '020201'));
  assert.ok(combos.some((item) => item.cClassTrib === '200046' && item.cst === '200'));
});

test('resolveNfseCorrelacaoReforma: redes de esgoto (07.02.01) resolve CST 200 / cClassTrib 200046', () => {
  const combo = resolveNfseCorrelacaoReforma({ codigo: '070201', codigoNbs: '101025310' });
  assert.deepEqual(combo, {
    codigoNbs: '101025310',
    cClassTrib: '200046',
    cst: '200',
    cIndOp: '020201',
  });
});

test('resolveNfseCorrelacaoReforma: ignora classificação condicional quando há alternativa', () => {
  // 200045 (reabilitação urbana) depende de projeto específico — não serve de padrão.
  const combo = resolveNfseCorrelacaoReforma({ codigo: '070602', codigoNbs: '101072000' });
  assert.equal(combo?.cClassTrib, '200046');
});

test('resolveNfseCorrelacaoReforma: valor informado vira preferência quando existe na tabela', () => {
  const combo = resolveNfseCorrelacaoReforma({
    codigo: '070602',
    codigoNbs: '101072000',
    cClassTrib: '200045',
  });
  assert.equal(combo?.cClassTrib, '200045');
  assert.equal(combo?.cst, '200');
});

test('resolveNfseCorrelacaoReforma: valor informado inválido não impede a resolução', () => {
  const combo = resolveNfseCorrelacaoReforma({
    codigo: '070201',
    codigoNbs: '101025310',
    cIndOp: '999999',
    cClassTrib: '000001',
  });
  assert.equal(combo?.cIndOp, '020201');
  assert.equal(combo?.cClassTrib, '200046');
});

test('resolveNfseCorrelacaoReforma: NBS fora da lista do serviço devolve null', () => {
  assert.equal(resolveNfseCorrelacaoReforma({ codigo: '070201', codigoNbs: '113022100' }), null);
});

test('resolveNfseCorrelacaoReforma: serviço fora da tabela devolve null', () => {
  assert.equal(resolveNfseCorrelacaoReforma({ codigo: '999999', codigoNbs: '101025310' }), null);
  assert.equal(hasNfseCorrelacaoForCodigo('999999'), false);
});

test('resolveNfseCorrelacaoReforma: sem NBS escolhe a combinação preferida do serviço', () => {
  const combo = resolveNfseCorrelacaoReforma({ codigo: '070201' });
  assert.equal(combo?.cst, '200');
  assert.equal(combo?.cIndOp, '020201');
});

test('isNfseCodigoNbsValidoForCodigo: valida o par serviço/NBS', () => {
  assert.equal(isNfseCodigoNbsValidoForCodigo('070201', '101025310'), true);
  assert.equal(isNfseCodigoNbsValidoForCodigo('070201', '119011000'), false);
  assert.equal(isNfseCodigoNbsValidoForCodigo('070201', '123'), false);
});

test('listNfseCodigoNbsOptionsForCodigo: NBS sem repetição e com descrição', () => {
  const opcoes = listNfseCodigoNbsOptionsForCodigo('171901');
  assert.equal(opcoes.length, 3);
  assert.equal(opcoes[0].codigoNbs, '113022100');
  assert.match(opcoes[0].descricao, /contabilidade/i);
});

test('formatNfseCodigoNbsOptionsMessage: resume a lista para o contador', () => {
  const msg = formatNfseCodigoNbsOptionsMessage('070201', { limite: 2 });
  assert.match(msg, /^101011100 \(/);
  assert.match(msg, /e outros \d+$/);
  assert.equal(formatNfseCodigoNbsOptionsMessage('999999'), '');
});

test('describeCodigoTributacaoNacional: devolve a descrição oficial', () => {
  assert.match(describeCodigoTributacaoNacional('171901'), /Contabilidade/i);
  assert.equal(describeCodigoTributacaoNacional('999999'), '');
});

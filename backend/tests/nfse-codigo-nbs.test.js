import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichCodigosServicosComNbs,
  lookupDefaultCodigoNbs,
  normalizeCodigoNbs,
  resolveCodigoNbsForServico,
  resolveCodigoTributacaoForServico,
} from '../src/services/nfse-codigo-nbs.js';

test('normalizeCodigoNbs aceita 9 dígitos com ou sem máscara', () => {
  assert.equal(normalizeCodigoNbs('114061100'), '114061100');
  assert.equal(normalizeCodigoNbs('1.14.06.11.00'), '114061100');
  assert.equal(normalizeCodigoNbs(''), null);
  assert.equal(normalizeCodigoNbs('12345'), null);
});

test('lookupDefaultCodigoNbs resolve códigos LC 116 conhecidos', () => {
  assert.equal(lookupDefaultCodigoNbs('170601'), '114061100');
  assert.equal(lookupDefaultCodigoNbs('17.06.01'), '114061100');
  assert.equal(lookupDefaultCodigoNbs('140101'), '120013110');
  assert.equal(lookupDefaultCodigoNbs('060301'), '126023000');
  assert.equal(lookupDefaultCodigoNbs('999999'), null);
});

test('resolveCodigoNbsForServico prioriza valor explícito', () => {
  assert.equal(
    resolveCodigoNbsForServico({ codigo: '170601', codigoNbs: '114061200' }),
    '114061200',
  );
  assert.equal(resolveCodigoNbsForServico({ codigo: '170601' }), '114061100');
});

test('enrichCodigosServicosComNbs adiciona codigo_nbs nas linhas', () => {
  const out = enrichCodigosServicosComNbs([
    { codigo: '170601', descricao: 'Propaganda' },
    { codigo: '010101', descricao: 'TI' },
  ]);
  assert.equal(out[0].codigo_nbs, '114061100');
  assert.equal(out[1].codigo_nbs, null);
});

test('resolveCodigoTributacaoForServico usa 001 por padrão (ADN / RJ)', () => {
  assert.equal(resolveCodigoTributacaoForServico({}), '001');
  assert.equal(resolveCodigoTributacaoForServico({ codigoTributacao: '1' }), '001');
  assert.equal(resolveCodigoTributacaoForServico({ codigoTributacao: '12' }), '012');
  assert.equal(resolveCodigoTributacaoForServico({ cTribMun: '045' }), '045');
});

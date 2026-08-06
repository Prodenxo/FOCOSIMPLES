import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveRetailNcmAliasCodes,
  scoreIndustrialMedicalPenalty,
} from '../src/lib/ncm-retail-aliases.js';
import {
  extractNcmSearchTokens,
  formatNcmLabel,
  mapBrasilApiNcmRows,
  normalizeNcmCode,
  rankNcmRows,
  stripNcmHtml,
} from '../src/services/ncm-catalog.service.js';

test('normalizeNcmCode aceita código com pontos', () => {
  assert.equal(normalizeNcmCode('4820.20.00'), '48202000');
  assert.equal(normalizeNcmCode('48202000'), '48202000');
  assert.equal(normalizeNcmCode('4820'), '');
});

test('formatNcmLabel exibe código amigável', () => {
  assert.equal(formatNcmLabel('48202000', '- Cadernos'), '4820.20.00 - Cadernos');
});

test('stripNcmHtml remove tags da BrasilAPI', () => {
  assert.equal(
    stripNcmHtml('Peixe-sapo (<i>Lophius gastrophysus</i>)'),
    'Peixe-sapo (Lophius gastrophysus)',
  );
});

test('mapBrasilApiNcmRows filtra só 8 dígitos', () => {
  const rows = mapBrasilApiNcmRows([
    { codigo: '48', descricao: 'Capítulo' },
    { codigo: '4820.20.00', descricao: '- Cadernos' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, '48202000');
  assert.equal(rows[0].description, 'Cadernos');
});

test('extractNcmSearchTokens remove stopwords', () => {
  const tokens = extractNcmSearchTokens('caderno escolar de papel');
  assert.ok(tokens.includes('caderno'));
  assert.ok(!tokens.includes('de'));
});

test('rankNcmRows prioriza match na descrição', () => {
  const ranked = rankNcmRows(
    [
      { code: '01012100', description: 'Reprodutores' },
      { code: '48202000', description: 'Cadernos escolares' },
    ],
    ['caderno'],
  );
  assert.equal(ranked[0]?.code, '48202000');
});

test('resolveRetailNcmAliasCodes mapeia termos de varejo', () => {
  assert.deepEqual(resolveRetailNcmAliasCodes('refrigerante'), ['22021000']);
  assert.deepEqual(resolveRetailNcmAliasCodes('coca cola'), ['22021000']);
  assert.deepEqual(resolveRetailNcmAliasCodes('cerveja'), ['22030000']);
  assert.deepEqual(resolveRetailNcmAliasCodes('bolacha'), ['19053100']);
});

test('rankNcmRows penaliza refrigerador ao buscar refrigerante', () => {
  const ranked = rankNcmRows(
    [
      { code: '84185000', description: 'Refrigeradores domésticos' },
      { code: '22021000', description: 'Águas, incluindo águas minerais e gaseificadas, e refrigerantes' },
    ],
    ['refrigerante'],
  );
  assert.equal(ranked[0]?.code, '22021000');
});

test('rankNcmRows penaliza folha de coca ao buscar coca', () => {
  const ranked = rankNcmRows(
    [
      { code: '12119000', description: 'Folha de coca (Erythroxylum)' },
      { code: '22021000', description: 'Refrigerantes de cola' },
    ],
    ['coca'],
  );
  assert.equal(ranked[0]?.code, '22021000');
});

test('scoreIndustrialMedicalPenalty aumenta para termos industriais', () => {
  const penalty = scoreIndustrialMedicalPenalty('Equipamento de refrigeração industrial', ['refrigerante']);
  assert.ok(penalty >= 40);
});

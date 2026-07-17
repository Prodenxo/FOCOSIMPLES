import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachNormalizedCnaes,
  extractCnaesSecundariosFromRaw,
  normalizeCnaeCodigo,
} from '../src/services/cnpj-lookup.service.js';

test('normalizeCnaeCodigo preenche 7 dígitos', () => {
  assert.equal(normalizeCnaeCodigo(6201501), '6201501');
  assert.equal(normalizeCnaeCodigo('6201-5/01'), '6201501');
});

test('extractCnaesSecundariosFromRaw lê BrasilAPI', () => {
  const list = extractCnaesSecundariosFromRaw({
    cnaes_secundarios: [
      { codigo: 7319002, descricao: 'Promoção de vendas' },
      { codigo: '7319002', descricao: 'dup' },
    ],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].codigo, '7319002');
});

test('attachNormalizedCnaes une principal + secundários', () => {
  const data = attachNormalizedCnaes({
    cnaePrincipal: { codigo: '6201501', descricao: 'Dev de software' },
    raw: {
      cnaes_secundarios: [{ codigo: 7319002, descricao: 'Promo' }],
    },
  });
  assert.equal(data.cnaes.length, 2);
  assert.equal(data.cnaes[0].principal, true);
  assert.equal(data.cnaes[1].codigo, '7319002');
  assert.equal(data.cnaesSecundarios.length, 1);
});

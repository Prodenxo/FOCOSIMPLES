import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMunicipioLookupKey,
  resolveIbgeCodigoFromMunicipio,
  resetIbgeMunicipiosLookupCache,
} from '../src/services/ibge-municipios-lookup.service.js';

test('normalizeMunicipioLookupKey ignora acentos e caixa', () => {
  assert.equal(
    normalizeMunicipioLookupKey('Rio de Janeiro', 'rj'),
    'rio de janeiro|RJ',
  );
  assert.equal(
    normalizeMunicipioLookupKey('São Paulo', 'SP'),
    'sao paulo|SP',
  );
});

test('resolveIbgeCodigoFromMunicipio encontra código na tabela local', () => {
  resetIbgeMunicipiosLookupCache();
  assert.equal(resolveIbgeCodigoFromMunicipio('Rio de Janeiro', 'RJ'), '3304557');
  assert.equal(resolveIbgeCodigoFromMunicipio('PORTO VELHO', 'RO'), '1100205');
  assert.equal(resolveIbgeCodigoFromMunicipio('Cidade Inexistente', 'SP'), null);
});

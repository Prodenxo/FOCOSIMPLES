import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIbgeMunicipioCodigo } from '../src/utils/ibge-municipio-codigo.js';

test('normalizeIbgeMunicipioCodigo — vazio para null/undefined', () => {
  assert.equal(normalizeIbgeMunicipioCodigo(null), '');
  assert.equal(normalizeIbgeMunicipioCodigo(undefined), '');
});

test('normalizeIbgeMunicipioCodigo — dígitos apenas e número', () => {
  assert.equal(normalizeIbgeMunicipioCodigo('3550 308'), '3550308');
  assert.equal(normalizeIbgeMunicipioCodigo(3550308), '3550308');
});

test('normalizeIbgeMunicipioCodigo — idempotente', () => {
  assert.equal(normalizeIbgeMunicipioCodigo('3550308'), '3550308');
  assert.equal(normalizeIbgeMunicipioCodigo(normalizeIbgeMunicipioCodigo('3550308')), '3550308');
});

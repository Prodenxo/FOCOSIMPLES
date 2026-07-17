import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCategoriesToMinimalRows } from '../src/services/categories.service.js';

test('mapCategoriesToMinimalRows devolve apenas id e nome', () => {
  const input = [
    { id: 1, nome: 'A', tipo: 'entrada', user_id: 'u1' },
    { id: 2, nome: 'B', tipo: 'saida', user_id: 'u1' },
  ];
  assert.deepEqual(mapCategoriesToMinimalRows(input), [
    { id: 1, nome: 'A' },
    { id: 2, nome: 'B' },
  ]);
});

test('mapCategoriesToMinimalRows com array vazio', () => {
  assert.deepEqual(mapCategoriesToMinimalRows([]), []);
});

test('mapCategoriesToMinimalRows com entrada null-ish', () => {
  assert.deepEqual(mapCategoriesToMinimalRows(undefined), []);
});

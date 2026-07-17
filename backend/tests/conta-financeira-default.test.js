import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCarteiraHintFromText,
  matchContaByTipoHint,
  resolveExplicitContaFromPayload,
  resolveContaIdFromPayload,
} from '../src/services/conta-financeira-default.js';

const contas = [
  { id: 'a', nome: 'Meu Financeiro', tipo: 'dinheiro', ativo: true },
  { id: 'b', nome: 'Nubank', tipo: 'corrente', ativo: true },
  { id: 'c', nome: 'Reserva', tipo: 'poupanca', ativo: true },
];

test('resolveExplicitContaFromPayload não aplica default', () => {
  assert.equal(resolveExplicitContaFromPayload(contas, {}), null);
  assert.equal(resolveExplicitContaFromPayload(contas, { carteira: 'Nubank' })?.id, 'b');
  assert.equal(resolveExplicitContaFromPayload(contas, { carteira: 'Itaú' }), null);
});

test('resolveContaIdFromPayload aplica default só sem pedido explícito', () => {
  assert.equal(resolveContaIdFromPayload(contas, {}), 'a');
  assert.equal(resolveContaIdFromPayload(contas, { carteira: 'Nubank' }), 'b');
});

test('matchContaByTipoHint com uma poupança', () => {
  assert.equal(matchContaByTipoHint(contas, 'poupança')?.id, 'c');
});

test('extractCarteiraHintFromText', () => {
  assert.equal(extractCarteiraHintFromText('transferi no Nubank'), 'Nubank');
  assert.equal(extractCarteiraHintFromText('na poupança'), 'poupança');
});

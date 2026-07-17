import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj } from '../src/utils/cpf-cnpj.js';

test('isValidCnpj rejeita CNPJ fantasma sequencial', () => {
  assert.equal(isValidCnpj('123456789000110'), false);
  assert.equal(isValidCnpj('11.111.111/1111-11'), false);
});

test('isValidCpf rejeita CPF inválido', () => {
  assert.equal(isValidCpf('11111111111'), false);
  assert.equal(isValidCpf('12345678901'), false);
});

test('isValidCpfOrCnpj aceita documentos válidos conhecidos', () => {
  assert.equal(isValidCnpj('11222333000181'), true);
  assert.equal(isValidCpf('52998224725'), true);
});

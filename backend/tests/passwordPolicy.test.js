import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRONG_PASSWORD_MIN_LENGTH,
  validateStrongPassword,
  generateStrongRandomPassword
} from '../src/utils/passwordPolicy.js';

test('validateStrongPassword rejeita senhas fracas', () => {
  assert.equal(validateStrongPassword('').ok, false);
  assert.equal(validateStrongPassword('Aa!').ok, false);
  assert.equal(validateStrongPassword('abcdefg!').ok, false);
  assert.equal(validateStrongPassword('ABCDEFGH').ok, false);
  assert.equal(validateStrongPassword('abcdefgh').ok, false);
});

test('validateStrongPassword aceita senha forte', () => {
  const r = validateStrongPassword('Abcd!efg');
  assert.equal(r.ok, true);
});

test('generateStrongRandomPassword satisfaz a política', () => {
  for (let i = 0; i < 20; i += 1) {
    const pwd = generateStrongRandomPassword();
    assert.ok(pwd.length >= STRONG_PASSWORD_MIN_LENGTH);
    const v = validateStrongPassword(pwd);
    assert.equal(v.ok, true, `falhou: ${pwd}`);
  }
});

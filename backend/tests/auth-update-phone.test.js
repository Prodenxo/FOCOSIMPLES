import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeBrazilWhatsappPhone,
  normalizeWhatsappPhoneDigits,
} from '../src/utils/whatsapp-phone.js';

/** Espelha regras de `assertValidWhatsappPhone` em auth.service.js */
const validateBrWhatsappPhone = (phone) => {
  const digits = normalizeWhatsappPhoneDigits(phone);
  if (!digits.startsWith('55')) return { ok: true };

  const cleaned = canonicalizeBrazilWhatsappPhone(digits);
  const national = cleaned.slice(2);
  if (!national || national.length < 10 || national.length > 11) {
    return { ok: false, reason: 'invalid_length' };
  }
  return { ok: true, cleaned };
};

test('celular BR válido com nono dígito', () => {
  const result = validateBrWhatsappPhone('5521996185328');
  assert.equal(result.ok, true);
  assert.equal(result.cleaned, '5521996185328');
});

test('aceita celular BR com 8 dígitos após o DDD (sem nono dígito)', () => {
  const result = validateBrWhatsappPhone('556696851098');
  assert.equal(result.ok, true);
  assert.equal(result.cleaned, '5566996851098');
});

test('rejeita número curto demais', () => {
  const result = validateBrWhatsappPhone('5521996185');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_length');
});

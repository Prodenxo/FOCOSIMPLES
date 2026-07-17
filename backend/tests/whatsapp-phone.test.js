import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeBrazilWhatsappPhone,
  canonicalizeWhatsappPhone,
  expandBrazilMobilePhoneVariants,
  expandWhatsappPhoneLookupVariants,
  isBrazilWhatsappDigits,
  normalizeWhatsappPhoneDigits,
} from '../src/utils/whatsapp-phone.js';
import { buildPhoneLookupCandidates } from '../src/services/openclaw-bot.service.js';
import { resolveOpenclawWhatsappPhone } from '../src/services/openclaw-bot.service.js';

test('normalizeWhatsappPhoneDigits remove não dígitos e sufixo @', () => {
  assert.equal(
    normalizeWhatsappPhoneDigits('5548912345678@s.whatsapp.net'),
    '5548912345678',
  );
});

test('nono dígito: Z-API sem 9 encontra cadastro com 9 (Rosiele MG 35)', () => {
  const zapi = '553597100397';
  const cadastro = '5535997100397';
  const variants = expandBrazilMobilePhoneVariants(zapi);
  assert.ok(variants.includes(cadastro), `variants=${variants.join(',')}`);
  const candidates = buildPhoneLookupCandidates(zapi);
  assert.ok(candidates.includes(cadastro), `candidates=${candidates.join(',')}`);
});

test('nono dígito: cadastro sem 9 encontra WhatsApp com 9', () => {
  const zapi = '5535997100397';
  const legado = '553597100397';
  const candidates = buildPhoneLookupCandidates(zapi);
  assert.ok(candidates.includes(legado));
});

test('canonicalizeBrazilWhatsappPhone prefere 13 dígitos com 55', () => {
  assert.equal(canonicalizeBrazilWhatsappPhone('553597100397'), '5535997100397');
  assert.equal(canonicalizeBrazilWhatsappPhone('5535997100397'), '5535997100397');
  assert.equal(canonicalizeBrazilWhatsappPhone('35997100397'), '5535997100397');
});

test('linha fixa 10 dígitos sem 9 inicial não ganha nono dígito extra', () => {
  const fixo = '553533221234';
  const variants = expandBrazilMobilePhoneVariants(fixo);
  assert.equal(variants.length, 1);
  assert.equal(variants[0], fixo);
});

test('internacional: não aplica variantes BR nem prefixo 55 fantasma', () => {
  const pt = '351912345678';
  assert.equal(isBrazilWhatsappDigits(pt), false);
  assert.deepEqual(expandWhatsappPhoneLookupVariants(pt), [pt]);
  const candidates = buildPhoneLookupCandidates(pt);
  assert.ok(candidates.includes(pt));
  assert.ok(!candidates.includes(`55${pt}`));
});

test('internacional: canonicalize mantém DDI', () => {
  assert.equal(canonicalizeWhatsappPhone('351912345678'), '351912345678');
});

test('resolveOpenclawWhatsappPhone não força 55 em internacional', () => {
  assert.equal(
    resolveOpenclawWhatsappPhone('351912345678', '351912345678'),
    '351912345678',
  );
  assert.equal(
    resolveOpenclawWhatsappPhone('21996185328', '5521996185328'),
    '5521996185328',
  );
});

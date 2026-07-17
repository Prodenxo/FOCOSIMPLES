import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsappPhoneDigits } from '../src/utils/whatsapp-phone.js';
import {
  buildPhoneLookupCandidates,
  parseMesCompetenciaMmYyyy,
  mesCompetenciaAtualUtc,
  mesCompetenciaDasVencimentoDia20,
  resolveDasCompetenciaFromPayload,
  resolveOpenclawWhatsappPhone,
  assertActorCanAccessDasForUser,
} from '../src/services/openclaw-bot.service.js';

test('normalizeWhatsappPhoneDigits remove não dígitos e sufixo @', () => {
  assert.equal(
    normalizeWhatsappPhoneDigits('5548912345678@s.whatsapp.net'),
    '5548912345678',
  );
  assert.equal(
    normalizeWhatsappPhoneDigits('+55 (48) 91234-5678'),
    '5548912345678',
  );
});

test('buildPhoneLookupCandidates inclui variante com 55', () => {
  assert.ok(buildPhoneLookupCandidates('48991234567').includes('5548991234567'));
  assert.ok(buildPhoneLookupCandidates('5548991234567').includes('48991234567'));
});

test('parseMesCompetenciaMmYyyy normaliza MM/YYYY', () => {
  assert.deepEqual(parseMesCompetenciaMmYyyy('5/2026'), {
    display: '05/2026',
    periodoDigits: '202605',
  });
  assert.deepEqual(parseMesCompetenciaMmYyyy('05/2026'), {
    display: '05/2026',
    periodoDigits: '202605',
  });
  assert.equal(parseMesCompetenciaMmYyyy('13/2026'), null);
  assert.equal(parseMesCompetenciaMmYyyy('05-2026'), null);
  assert.equal(parseMesCompetenciaMmYyyy(''), null);
});

test('mesCompetenciaAtualUtc devolve display e periodoDigits coerentes', () => {
  const r = mesCompetenciaAtualUtc();
  assert.match(r.display, /^\d{2}\/\d{4}$/);
  assert.match(r.periodoDigits, /^\d{6}$/);
  const parsed = parseMesCompetenciaMmYyyy(r.display);
  assert.deepEqual(parsed?.periodoDigits, r.periodoDigits);
});

test('mesCompetenciaDasVencimentoDia20 — junho/2026 → competência 05/2026', () => {
  const r = mesCompetenciaDasVencimentoDia20(new Date('2026-06-09T15:00:00Z'));
  assert.equal(r.display, '05/2026');
  assert.equal(r.periodoDigits, '202605');
  assert.equal(r.vencimentoDisplay, '20/06/2026');
});

test('resolveDasCompetenciaFromPayload sem mes usa vencimento dia 20', () => {
  const r = resolveDasCompetenciaFromPayload({}, new Date('2026-06-09T15:00:00Z'));
  assert.equal(r.display, '05/2026');
  assert.equal(r.resolvedBy, 'vencimento_dia_20');
});

test('resolveDasCompetenciaFromPayload com mes explícito', () => {
  const r = resolveDasCompetenciaFromPayload({ mes: '06/2026' });
  assert.equal(r.display, '06/2026');
  assert.equal(r.resolvedBy, 'explicit_mes');
});

test('resolveOpenclawWhatsappPhone normaliza DDI 55', () => {
  assert.equal(resolveOpenclawWhatsappPhone('21996185328', '5521996185328'), '5521996185328');
  assert.equal(resolveOpenclawWhatsappPhone('5521996185328', null), '5521996185328');
  assert.equal(resolveOpenclawWhatsappPhone('', ''), '');
});

test('assertActorCanAccessDasForUser bloqueia utilizador comum a ver DAS alheio', async () => {
  await assert.rejects(
    () =>
      assertActorCanAccessDasForUser({
        actorUserId: 'user-a',
        actorContext: {
          memberships: [{ role: 'usuario', empresaId: 'emp-1', empresaNome: 'A' }],
          hasActiveMembership: true,
          profileRole: 'usuario',
          hasSuperadminCapability: false,
        },
        targetUserId: 'user-b',
      }),
    /Só podes consultar/,
  );
});

test('assertActorCanAccessDasForUser permite mesma conta', async () => {
  await assert.doesNotReject(() =>
    assertActorCanAccessDasForUser({
      actorUserId: 'user-a',
      actorContext: { memberships: [], hasSuperadminCapability: false },
      targetUserId: 'user-a',
    }),
  );
});

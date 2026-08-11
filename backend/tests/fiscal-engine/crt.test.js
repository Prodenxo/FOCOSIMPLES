import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crtMatchesRule,
  crtSupportsCsosn,
  CRT,
  CRT_MEI_PROFILE,
} from '../../src/fiscal-engine/types/crt.js';

test('CRT 4 possui profile próprio — não herda CRT 1 implicitamente', () => {
  assert.equal(CRT_MEI_PROFILE.sharesBaseRulesWithCrt1, false);
});

test('crtMatchesRule exige applicableCrt explícito', () => {
  assert.equal(crtMatchesRule(CRT.SIMPLES_NACIONAL, undefined), false);
  assert.equal(crtMatchesRule(CRT.SIMPLES_NACIONAL, []), false);
  assert.equal(crtMatchesRule(CRT.MEI, [1, 4]), true);
  assert.equal(crtMatchesRule(CRT.SIMPLES_EXCESSO, [1]), false);
});

test('crtSupportsCsosn apenas 1 e 4', () => {
  assert.equal(crtSupportsCsosn(CRT.SIMPLES_NACIONAL), true);
  assert.equal(crtSupportsCsosn(CRT.MEI), true);
  assert.equal(crtSupportsCsosn(CRT.SIMPLES_EXCESSO), false);
  assert.equal(crtSupportsCsosn(CRT.REGIME_NORMAL), false);
});

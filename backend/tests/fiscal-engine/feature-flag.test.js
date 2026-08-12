import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  assertShadowDoesNotAuthorizeEmission,
  canFiscalEngineV3AndShadowCoexist,
  __withFiscalEngineV3FlagForTests,
  __withFiscalEngineV3ShadowFlagForTests,
  __withFiscalEngineFlagsForTests,
} from '../../src/fiscal-engine/feature-flag.js';

test('FISCAL_ENGINE_V3 desligado por padrão', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('FISCAL_ENGINE_V3 liga com true', async () => {
  await __withFiscalEngineV3FlagForTests(true, async () => {
    assert.equal(isFiscalEngineV3Enabled(), true);
  });
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('FISCAL_ENGINE_V3_SHADOW desligado por padrão', () => {
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('FISCAL_ENGINE_V3_SHADOW liga com true', async () => {
  await __withFiscalEngineV3ShadowFlagForTests(true, async () => {
    assert.equal(isFiscalEngineV3ShadowEnabled(), true);
  });
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('Fase 8A — V3 e SHADOW podem coexistir sem throw', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: true }, async () => {
    assert.doesNotThrow(() => assertShadowDoesNotAuthorizeEmission());
    assert.equal(canFiscalEngineV3AndShadowCoexist(), true);
  });
});

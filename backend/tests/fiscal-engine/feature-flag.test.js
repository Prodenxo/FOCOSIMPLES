import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  __withFiscalEngineV3FlagForTests,
  __withFiscalEngineV3ShadowFlagForTests,
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

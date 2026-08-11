import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFiscalEngineV3Enabled,
  __withFiscalEngineV3FlagForTests,
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveUrlsForLog } from '../src/utils/log-redact.js';

test('redactSensitiveUrlsForLog — não altera paths sem validate', () => {
  assert.equal(redactSensitiveUrlsForLog('/api/invites'), '/api/invites');
  assert.equal(redactSensitiveUrlsForLog('/health'), '/health');
});

test('redactSensitiveUrlsForLog — mascarar query em /api/invites/validate', () => {
  assert.equal(
    redactSensitiveUrlsForLog('/api/invites/validate?token=secret123&x=1'),
    '/api/invites/validate?token=[REDACTED]'
  );
});

test('redactSensitiveUrlsForLog — validate sem query não quebra', () => {
  assert.equal(redactSensitiveUrlsForLog('/api/invites/validate'), '/api/invites/validate');
});

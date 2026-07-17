import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAccessManagementCommandMessage,
  isMfAccessCommandMessage,
  toInternalAccessCommandText,
} from '../src/services/access-request-command-text.service.js';

test('mf pendentes — formato minimalista', () => {
  assert.equal(toInternalAccessCommandText('mf pendentes'), 'PENDENTES');
  assert.equal(toInternalAccessCommandText('MF PENDENTES'), 'PENDENTES');
  assert.equal(toInternalAccessCommandText('mf aprovar a@b.com'), 'APROVAR a@b.com');
  assert.equal(isMfAccessCommandMessage('mf pendentes'), true);
  assert.equal(isMfAccessCommandMessage('mf aprovar x@y.com'), true);
  assert.equal(isMfAccessCommandMessage('olá mf'), false);
});

test('mf cadastro … ainda funciona (alias)', () => {
  assert.equal(toInternalAccessCommandText('mf cadastro pendentes'), 'PENDENTES');
  assert.equal(toInternalAccessCommandText('MF CADASTRO APROVAR z@z.com'), 'APROVAR z@z.com');
});

test('legado sem mf', () => {
  assert.equal(toInternalAccessCommandText('/pendentes'), 'PENDENTES');
  assert.equal(isAccessManagementCommandMessage('pendentes'), true);
});

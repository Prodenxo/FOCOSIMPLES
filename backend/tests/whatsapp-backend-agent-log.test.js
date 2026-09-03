import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLogPhone } from '../src/services/whatsapp-backend-agent-log.service.js';

test('normalizeLogPhone deixa só dígitos', () => {
  assert.equal(normalizeLogPhone('+55 (11) 98888-7777'), '5511988887777');
  assert.equal(normalizeLogPhone(''), '');
});

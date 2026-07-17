import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertOpenclawSuperadmin,
  CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS,
  formatPendingAccessRequestsForOpenclaw,
} from '../src/services/openclaw-access-requests.service.js';

test('assertOpenclawSuperadmin aceita hasSuperadminCapability', () => {
  assert.doesNotThrow(() => assertOpenclawSuperadmin({ hasSuperadminCapability: true }));
});

test('assertOpenclawSuperadmin rejeita usuario comum', () => {
  assert.throws(
    () => assertOpenclawSuperadmin({ profileRole: 'usuario', hasSuperadminCapability: false }),
    /superadmin/i,
  );
});

test('formatPendingAccessRequestsForOpenclaw lista emails', () => {
  const text = formatPendingAccessRequestsForOpenclaw([
    {
      userId: 'u1',
      email: 'a@b.com',
      fullName: 'Ana',
      phone: '5511999999999',
      empresa: { cnpj: '123', nome: 'Empresa X' },
    },
  ]);
  assert.ok(text.includes('a@b.com'));
  assert.ok(text.includes('approve_access_request'));
});

test('CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS proíbe DAS no mesmo turno', () => {
  assert.match(CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS, /DAS MEI/i);
  assert.match(CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS, /get_das_current/i);
});

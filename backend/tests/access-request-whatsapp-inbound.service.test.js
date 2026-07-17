import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccessRequestSubmittedSuperadminMessage,
} from '../src/services/access-request-whatsapp.service.js';
import {
  findPendingAccessRequestByIdentifier,
  listPendingAccessRequests,
} from '../src/services/access-request-manage.service.js';
import {
  isAccessRequestWhatsappCommand,
  parseAccessRequestWhatsappCommand,
  buildPendingAccessRequestsListMessage,
} from '../src/services/access-request-whatsapp-inbound.service.js';
import {
  isSlashReservedMessage,
  shouldSkipOpenclawRelay,
} from '../src/services/zapi-slash-commands.service.js';
import { toInternalAccessCommandText } from '../src/services/access-request-command-text.service.js';

test('buildAccessRequestSubmittedSuperadminMessage inclui comando APROVAR', () => {
  const msg = buildAccessRequestSubmittedSuperadminMessage({
    fullName: 'Milena Paes',
    email: 'milena@exemplo.com',
    phone: '5522999877350',
    empresaNome: 'MPC LTDA',
    cnpj: '66518874000143',
  });
  assert.ok(msg.includes('mf aprovar milena@exemplo.com'));
  assert.ok(msg.includes('mf pendentes'));
});

test('mf pendentes no relay skip', () => {
  assert.equal(toInternalAccessCommandText('mf pendentes'), 'PENDENTES');
  assert.deepEqual(parseAccessRequestWhatsappCommand('mf aprovar a@b.com'), {
    action: 'approve',
    arg: 'a@b.com',
  });
  assert.equal(shouldSkipOpenclawRelay('mf pendentes', false), true);
  assert.equal(shouldSkipOpenclawRelay('/pendentes', false), true);
  assert.equal(shouldSkipOpenclawRelay('olá', false), false);
  assert.equal(isSlashReservedMessage('/pendentes'), true);
});

test('parseAccessRequestWhatsappCommand reconhece aprovar e listar', () => {
  assert.deepEqual(parseAccessRequestWhatsappCommand('APROVAR maria@exemplo.com'), {
    action: 'approve',
    arg: 'maria@exemplo.com',
  });
  assert.deepEqual(parseAccessRequestWhatsappCommand('pendentes'), { action: 'list' });
  assert.deepEqual(parseAccessRequestWhatsappCommand('REJEITAR 66.518.874/0001-43'), {
    action: 'reject',
    arg: '66.518.874/0001-43',
  });
});

test('isAccessRequestWhatsappCommand ignora conversa normal', () => {
  assert.equal(isAccessRequestWhatsappCommand('olá, preciso do das'), false);
  assert.equal(isAccessRequestWhatsappCommand('APROVAR teste@x.com'), true);
});

test('findPendingAccessRequestByIdentifier por e-mail e CNPJ', () => {
  const pending = [
    {
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'milena@exemplo.com',
      fullName: 'Milena',
      phone: '5522999877350',
      empresa: { cnpj: '66.518.874/0001-43' },
    },
  ];
  assert.equal(
    findPendingAccessRequestByIdentifier(pending, 'milena@exemplo.com')?.userId,
    pending[0].userId,
  );
  assert.equal(
    findPendingAccessRequestByIdentifier(pending, '66518874000143')?.userId,
    pending[0].userId,
  );
});

test('buildPendingAccessRequestsListMessage lista com comando copiável', () => {
  const msg = buildPendingAccessRequestsListMessage([
    {
      userId: 'u1',
      email: 'a@b.com',
      fullName: 'Ana',
      phone: null,
      empresa: { cnpj: '123' },
    },
  ]);
  assert.ok(msg.includes('APROVAR a@b.com'));
  assert.ok(msg.includes('Ana'));
});

test('listPendingAccessRequests é função exportada', () => {
  assert.equal(typeof listPendingAccessRequests, 'function');
});

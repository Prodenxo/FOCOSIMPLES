import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccessRequestApprovedApplicantMessage,
  buildAccessRequestSubmittedSuperadminMessage,
  getExtraSuperadminNotifyPhones,
  isAccessRequestWhatsappNotifyEnabled,
} from '../src/services/access-request-whatsapp.service.js';

test('buildAccessRequestSubmittedSuperadminMessage inclui dados principais', () => {
  const msg = buildAccessRequestSubmittedSuperadminMessage({
    fullName: 'Maria Silva',
    email: 'maria@exemplo.com',
    phone: '21999990000',
    empresaNome: 'Empresa X LTDA',
    cnpj: '17422651000172',
    observacao: 'MEI novo',
  });
  assert.ok(msg.includes('Maria Silva'));
  assert.ok(msg.includes('maria@exemplo.com'));
  assert.ok(msg.includes('17.422.651/0001-72'));
  assert.ok(msg.includes('MEI novo'));
  assert.ok(msg.includes('mf aprovar maria@exemplo.com'));
  assert.ok(msg.includes('mf pendentes'));
});

test('buildAccessRequestApprovedApplicantMessage personaliza nome', () => {
  const msg = buildAccessRequestApprovedApplicantMessage({
    fullName: 'João Pedro',
    email: 'joao@test.com',
  });
  assert.ok(msg.includes('João'));
  assert.ok(msg.includes('aprovado'));
  assert.ok(msg.includes('grupo de suporte'));
  assert.ok(msg.includes('chat.whatsapp.com'));
});

test('getExtraSuperadminNotifyPhones aceita lista separada por vírgula', () => {
  const prev = process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES;
  try {
    process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES = '21996185328, 5511988887777';
    const phones = getExtraSuperadminNotifyPhones();
    assert.equal(phones.length, 2);
    assert.equal(phones[0], '5521996185328');
    assert.equal(phones[1], '5511988887777');
  } finally {
    if (prev === undefined) delete process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES;
    else process.env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES = prev;
  }
});

test('isAccessRequestWhatsappNotifyEnabled exige flag e canal', () => {
  const prevFlag = process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED;
  const prevZapi = process.env.ZAPI_INSTANCE_ID;
  try {
    process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED = 'false';
    assert.equal(isAccessRequestWhatsappNotifyEnabled(), false);

    process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED = 'true';
    delete process.env.ZAPI_INSTANCE_ID;
    assert.equal(isAccessRequestWhatsappNotifyEnabled(), false);
  } finally {
    if (prevFlag === undefined) delete process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED;
    else process.env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED = prevFlag;
    if (prevZapi === undefined) delete process.env.ZAPI_INSTANCE_ID;
    else process.env.ZAPI_INSTANCE_ID = prevZapi;
  }
});

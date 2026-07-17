import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

import * as adminController from '../src/controllers/admin.controller.js';

const createRes = () => {
  return {
    payload: null,
    headers: {},
    body: null,
    json(body) {
      this.payload = body;
      return body;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    send(body) {
      this.body = body;
      return body;
    }
  };
};

test('admin controller retorna status de certificado MEI', async () => {
  const usersMock = { canViewUser: async () => true };
  const meiGuideMock = {
    getCertificateStatus: async (userId) => ({
      userId,
      hasUserCertificate: true,
      hasEnvCertificate: false,
      documento: '12345678000199',
      certValidFrom: '2024-01-01T00:00:00.000Z',
      certValidTo: '2025-12-31T23:59:59.000Z'
    })
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiGuideServiceForTests(meiGuideMock);

  try {
    const req = { accessToken: 'token', params: { userId: 'user-1' } };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.getAdminMeiCertificateStatus(req, res, next);

    assert.equal(nextError, null);
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.data?.documento, '12345678000199');
    assert.equal(res.payload?.data?.certValidFrom, '2024-01-01T00:00:00.000Z');
    assert.equal(res.payload?.data?.certValidTo, '2025-12-31T23:59:59.000Z');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiGuideServiceForTests();
  }
});

test('admin controller lista periodos MEI com filtro de cnpj', async () => {
  const usersMock = { canViewUser: async () => true };
  let received = null;
  const meiGuideMock = {
    listPeriods: async (userId, payload) => {
      received = { userId, payload };
      return [{ competencia: '2026-02', status: 'a_pagar' }];
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiGuideServiceForTests(meiGuideMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'user-2' },
      query: { cnpj: '12345678000199' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listAdminMeiPeriods(req, res, next);

    assert.equal(nextError, null);
    assert.deepEqual(received, {
      userId: 'user-2',
      payload: { cnpj: '12345678000199' }
    });
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.data?.length, 1);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiGuideServiceForTests();
  }
});

test('admin controller baixa guia MEI e retorna PDF', async () => {
  const usersMock = { canViewUser: async () => true };
  const meiGuideMock = {
    downloadGuide: async () => ({
      buffer: Buffer.from('pdf'),
      contentType: 'application/pdf',
      filename: 'guia-mei.pdf'
    })
  };
  let receivedBase64 = null;
  const base64Mock = {
    upsertDasBase64: async (payload) => {
      receivedBase64 = payload;
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiGuideServiceForTests(meiGuideMock);
  adminController.__setMeiGuideDasBase64ServiceForTests(base64Mock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'user-3', periodoApuracao: '202602' },
      query: { cnpj: '12345678000199' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.downloadAdminMeiGuide(req, res, next);

    assert.equal(nextError, null);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.match(String(res.headers['Content-Disposition'] || ''), /guia-mei.pdf/);
    assert.equal(res.body.toString(), 'pdf');
    assert.equal(receivedBase64?.userId, 'user-3');
    assert.equal(receivedBase64?.periodoApuracao, '202602');
    assert.equal(receivedBase64?.pdfBase64, Buffer.from('pdf').toString('base64'));
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiGuideServiceForTests();
    adminController.__setMeiGuideDasBase64ServiceForTests();
  }
});

test('admin controller envia guia MEI via webhook', async () => {
  const usersMock = {
    canViewUser: async () => true,
    listUsers: async () => ({
      users: [{
        id: 'user-4',
        displayName: 'Maria',
        email: 'maria@example.com',
        phone: '5511999999999',
        empresaId: 'empresa-1',
        empresaName: 'Empresa X'
      }]
    })
  };
  const meiGuideMock = {
    getCertificateStatus: async () => ({ documento: '12345678000199' }),
    downloadGuide: async () => ({
      buffer: Buffer.from('pdf'),
      contentType: 'application/pdf',
      filename: 'guia-mei.pdf'
    })
  };
  const base64Mock = {
    getDasBase64: async () => Buffer.from('pdf').toString('base64'),
    upsertDasBase64: async () => null
  };
  let receivedPayload = null;
  const n8nMock = {
    sendWhatsappMessage: async (payload) => {
      receivedPayload = payload;
      return { status: 200, body: { ok: true } };
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiGuideServiceForTests(meiGuideMock);
  adminController.__setMeiGuideDasBase64ServiceForTests(base64Mock);
  adminController.__setN8nWhatsappServiceForTests(n8nMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'user-4' },
      body: { periodoApuracao: '202602', competencia: '2026-02' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.sendAdminMeiWhatsapp(req, res, next);

    assert.equal(nextError, null);
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.data?.sent, true);
    assert.equal(receivedPayload?.pdfBase64, Buffer.from('pdf').toString('base64'));
    assert.equal(receivedPayload?.fileName, 'das-mei-202602.pdf');
    assert.equal(receivedPayload?.displayName, 'Maria');
    assert.equal(receivedPayload?.competencia, '2026-02');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiGuideServiceForTests();
    adminController.__setMeiGuideDasBase64ServiceForTests();
    adminController.__setN8nWhatsappServiceForTests();
  }
});

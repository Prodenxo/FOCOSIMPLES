import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

import * as adminController from '../src/controllers/admin.controller.js';
import { badRequest, forbidden } from '../src/utils/errors.js';

const createRes = () => {
  return {
    payload: null,
    json(body) {
      this.payload = body;
      return body;
    }
  };
};

test('admin controller lista status DAS com filtros', async () => {
  let received = null;
  const serviceMock = {
    listAdminCompanyDasStatus: async (accessToken, filters) => {
      received = { accessToken, filters };
      return {
        competencia: '2026-02',
        totalClientes: 1,
        pendentes: 1,
        items: [{ userId: 'u-1', status: 'pendente' }]
      };
    }
  };
  adminController.__setMeiDasServiceForTests(serviceMock);

  try {
    const req = {
      accessToken: 'token-admin',
      query: { competencia: '2026-02', status: 'pendente', q: 'maria' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listDasStatus(req, res, next);

    assert.equal(nextError, null);
    assert.deepEqual(received, {
      accessToken: 'token-admin',
      filters: { competencia: '2026-02', status: 'pendente', q: 'maria' }
    });
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.data?.competencia, '2026-02');
    assert.equal(res.payload?.message, 'Status DAS listados');
  } finally {
    adminController.__setMeiDasServiceForTests();
  }
});

test('admin controller encaminha erro para status inválido no filtro DAS', async () => {
  const serviceMock = {
    listAdminCompanyDasStatus: async () => {
      throw badRequest('Status inválido. Use pago, pendente ou erro.');
    }
  };
  adminController.__setMeiDasServiceForTests(serviceMock);

  try {
    const req = {
      accessToken: 'token-admin',
      query: { status: 'invalido' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listDasStatus(req, res, next);

    assert.equal(res.payload, null);
    assert.equal(nextError?.status, 400);
    assert.match(String(nextError?.message || ''), /Status inválido/);
  } finally {
    adminController.__setMeiDasServiceForTests();
  }
});

test('admin controller reprocessa DAS manual quando autorizado', async () => {
  let received = null;
  const serviceMock = {
    reprocessDasForAdmin: async (accessToken, payload) => {
      received = { accessToken, payload };
      return {
        userId: payload.userId,
        competencia: payload.competencia,
        status: 'pendente',
        pdfPath: null
      };
    }
  };
  adminController.__setMeiDasServiceForTests(serviceMock);

  try {
    const req = {
      accessToken: 'token-admin',
      body: { userId: 'user-123', competencia: '2026-02' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.reprocessDas(req, res, next);

    assert.equal(nextError, null);
    assert.deepEqual(received, {
      accessToken: 'token-admin',
      payload: { userId: 'user-123', competencia: '2026-02' }
    });
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.message, 'Reprocessamento DAS concluído');
    assert.equal(res.payload?.data?.userId, 'user-123');
  } finally {
    adminController.__setMeiDasServiceForTests();
  }
});

test('admin controller bloqueia reprocessamento fora do escopo', async () => {
  const serviceMock = {
    reprocessDasForAdmin: async () => {
      throw forbidden('Usuário fora do escopo da empresa');
    }
  };
  adminController.__setMeiDasServiceForTests(serviceMock);

  try {
    const req = {
      accessToken: 'token-admin',
      body: { userId: 'user-sem-acesso', competencia: '2026-02' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.reprocessDas(req, res, next);

    assert.equal(res.payload, null);
    assert.equal(nextError?.status, 403);
    assert.match(String(nextError?.message || ''), /fora do escopo/);
  } finally {
    adminController.__setMeiDasServiceForTests();
  }
});

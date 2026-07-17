import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

import * as adminController from '../src/controllers/admin.controller.js';

const createRes = () => ({
  payload: null,
  statusCode: null,
  sent: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return body;
  },
  send(body) {
    this.sent = body;
    return this;
  }
});

test('admin lista catálogo NFS-e de clientes com userId da URL e query q/limit/documentType', async () => {
  const usersMock = { canViewUser: async () => true };
  let catalogCall = null;
  const meiNotasMock = {
    listarCatalogoClientes: async (userId, opts) => {
      catalogCall = { userId, opts };
      return [{ id: 'c1', nome: 'Cliente A', documento: '123' }];
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid' },
      query: { q: '  cli  ', limit: '10', documentType: 'nfse' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listAdminUserMeiCatalogoClientes(req, res, next);

    assert.equal(nextError, null);
    assert.equal(catalogCall?.userId, 'target-user-uuid');
    assert.deepEqual(catalogCall?.opts, { q: 'cli', limit: 10, documentType: 'nfse' });
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.message, 'Catálogo de clientes listado');
    assert.equal(res.payload?.data?.length, 1);
    assert.equal(res.payload?.data?.[0]?.nome, 'Cliente A');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin lista catálogo NFS-e de produtos/serviços com userId da URL e query q/limit/documentType', async () => {
  const usersMock = { canViewUser: async () => true };
  let catalogCall = null;
  const meiNotasMock = {
    listarCatalogoProdutos: async (userId, opts) => {
      catalogCall = { userId, opts };
      return [{ id: 'p1', codigo: '010101', discriminacao: 'Serviço X', cnae: '6201501' }];
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid' },
      query: { q: '  serv  ', limit: '15', documentType: 'NFSE' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listAdminUserMeiCatalogoProdutos(req, res, next);

    assert.equal(nextError, null);
    assert.equal(catalogCall?.userId, 'target-user-uuid');
    assert.deepEqual(catalogCall?.opts, { q: 'serv', limit: 15, documentType: 'NFSE' });
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.message, 'Catálogo de produtos listado');
    assert.equal(res.payload?.data?.length, 1);
    assert.equal(res.payload?.data?.[0]?.discriminacao, 'Serviço X');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin sem permissão para ver utilizador não lista catálogo (403)', async () => {
  const usersMock = { canViewUser: async () => false };
  let catalogCalled = false;
  const meiNotasMock = {
    listarCatalogoClientes: async () => {
      catalogCalled = true;
      return [];
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'other-user' },
      query: {}
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.listAdminUserMeiCatalogoClientes(req, res, next);

    assert.equal(catalogCalled, false);
    assert.equal(nextError?.status, 403);
    assert.equal(res.payload, null);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin POST catálogo cliente — 201 e delega criarCatalogoCliente com userId da URL', async () => {
  const usersMock = { canViewUser: async () => true };
  let createCall = null;
  const created = { id: 'new-c', nome: 'Novo', documento: '12345678000199' };
  const meiNotasMock = {
    criarCatalogoCliente: async (userId, body) => {
      createCall = { userId, body };
      return created;
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid' },
      body: { nome: 'Novo', documento: '12345678000199', documentType: 'NFSE' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.createAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(nextError, null);
    assert.equal(createCall?.userId, 'target-user-uuid');
    assert.equal(createCall?.body?.nome, 'Novo');
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.message, 'Cliente do catálogo registado');
    assert.equal(res.payload?.data?.id, 'new-c');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin POST catálogo cliente — 403 sem canViewUser; serviço não é chamado', async () => {
  const usersMock = { canViewUser: async () => false };
  let createCalled = false;
  const meiNotasMock = {
    criarCatalogoCliente: async () => {
      createCalled = true;
      return {};
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'other-user' },
      body: { nome: 'X', documento: '12345678000199' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.createAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(createCalled, false);
    assert.equal(nextError?.status, 403);
    assert.equal(res.payload, null);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin POST catálogo cliente — 403 quando MEI desativado para o utilizador alvo', async () => {
  const usersMock = {
    canViewUser: async () => true,
    listUsers: async () => ({
      users: [{ id: 'target-user-uuid', mei: false, email: 'u@exemplo.com' }]
    })
  };
  let createCalled = false;
  const meiNotasMock = {
    criarCatalogoCliente: async () => {
      createCalled = true;
      return {};
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid' },
      body: { nome: 'X', documento: '12345678000199' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.createAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(createCalled, false);
    assert.equal(nextError?.status, 403);
    assert.match(String(nextError?.message || ''), /MEI desabilitado/i);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin PATCH catálogo cliente — 200 e delega atualizarCatalogoCliente', async () => {
  const usersMock = { canViewUser: async () => true };
  let patchCall = null;
  const updated = { id: 'c1', nome: 'Atualizado', documento: '12345678000199' };
  const meiNotasMock = {
    atualizarCatalogoCliente: async (userId, id, body) => {
      patchCall = { userId, id, body };
      return updated;
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid', id: 'c1' },
      body: { nome: 'Atualizado', email: null }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.updateAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(nextError, null);
    assert.deepEqual(patchCall, {
      userId: 'target-user-uuid',
      id: 'c1',
      body: { nome: 'Atualizado', email: null }
    });
    assert.equal(res.statusCode, null);
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.message, 'Cliente do catálogo atualizado');
    assert.equal(res.payload?.data?.nome, 'Atualizado');
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin PATCH catálogo cliente — 403 sem canViewUser; serviço não é chamado', async () => {
  const usersMock = { canViewUser: async () => false };
  let patchCalled = false;
  const meiNotasMock = {
    atualizarCatalogoCliente: async () => {
      patchCalled = true;
      return {};
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'other', id: 'c1' },
      body: { nome: 'Y' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.updateAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(patchCalled, false);
    assert.equal(nextError?.status, 403);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin DELETE catálogo cliente — 204 e delega eliminarCatalogoCliente', async () => {
  const usersMock = { canViewUser: async () => true };
  let deleteCall = null;
  const meiNotasMock = {
    eliminarCatalogoCliente: async (userId, id) => {
      deleteCall = { userId, id };
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'target-user-uuid', id: 'c1' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.deleteAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(nextError, null);
    assert.deepEqual(deleteCall, { userId: 'target-user-uuid', id: 'c1' });
    assert.equal(res.statusCode, 204);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

test('admin DELETE catálogo cliente — 403 sem canViewUser; serviço não é chamado', async () => {
  const usersMock = { canViewUser: async () => false };
  let deleteCalled = false;
  const meiNotasMock = {
    eliminarCatalogoCliente: async () => {
      deleteCalled = true;
    }
  };
  adminController.__setUsersServiceForTests(usersMock);
  adminController.__setMeiNotasServiceForTests(meiNotasMock);

  try {
    const req = {
      accessToken: 'token',
      params: { userId: 'other', id: 'c1' }
    };
    const res = createRes();
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };

    await adminController.deleteAdminUserMeiCatalogoCliente(req, res, next);

    assert.equal(deleteCalled, false);
    assert.equal(nextError?.status, 403);
    assert.equal(res.statusCode, null);
  } finally {
    adminController.__setUsersServiceForTests();
    adminController.__setMeiNotasServiceForTests();
  }
});

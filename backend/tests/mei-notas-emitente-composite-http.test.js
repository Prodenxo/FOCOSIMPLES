import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import { createServer } from 'node:http';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';

const createJsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status >= 400 ? 'Error' : 'OK',
  headers: { get: () => 'application/json' },
  json: async () => payload
});

const empresaPayloadMin = () => JSON.stringify({
  cpfCnpj: '17422651000172',
  razaoSocial: 'Empresa Teste Composite',
  endereco: {
    codigoCidade: '3550308',
    estado: 'SP',
    uf: 'SP',
    logradouro: 'Rua A',
    numero: '1',
    bairro: 'Centro',
    cep: '01000000'
  }
});

const createCidadePreflightResponse = () => createJsonResponse(200, {
  padraoNacional: { producao: true, homologacao: false },
  login: { producao: false, homologacao: false },
  senha: { producao: false, homologacao: false }
});

const mountApp = async (controller) => {
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const {
    __setGetRequesterContextForTests,
    requireMeiEnabled
  } = await import('../src/middlewares/requireMei.js');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'emitente-composite-user' };
    req.accessToken = 'emitente-composite-token';
    next();
  });
  app.post(
    '/api/mei-notas/setup/emissao-fiscal/emitente',
    requireMeiEnabled,
    upload.single('arquivo'),
    controller.cadastrarPlugNotasEmitenteComposite
  );
  app.use(errorHandler);

  return { app, __setGetRequesterContextForTests };
};

const listen = (app) => new Promise((resolve, reject) => {
  const server = createServer(app);
  server.listen(0, () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    resolve({ server, port });
  });
  server.on('error', reject);
});

test('HTTP POST …/emitente — sucesso composto (certificado + empresa)', async () => {
  const controller = await import('../src/controllers/mei-notas.controller.js');
  const { app, __setGetRequesterContextForTests } = await mountApp(controller);
  const originalFetch = global.fetch;

  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('127.0.0.1') || u.includes('localhost')) {
      return originalFetch(url, init);
    }
    if (u.includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    if (u.includes('/certificado') && !u.includes('/empresa')) {
      return createJsonResponse(200, { message: 'OK', data: { id: 'cert-orch-1' } });
    }
    if (u.includes('/empresa') && init.method === 'POST') {
      return createJsonResponse(200, {
        message: 'Cadastro efetuado com sucesso',
        data: { cnpj: '17422651000172' }
      });
    }
    return createJsonResponse(500, { message: 'unexpected url', url: u });
  };

  __setGetRequesterContextForTests(async () => ({ role: 'admin', mei: true }));

  const { server, port } = await listen(app);

  try {
    const body = new FormData();
    body.append('arquivo', new Blob([new Uint8Array([1, 2])]), 'cert.pfx');
    body.append('senha', 'secret');
    body.append('payload', empresaPayloadMin());

    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/setup/emissao-fiscal/emitente`, {
      method: 'POST',
      body
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data?.certificado?.id, 'cert-orch-1');
    assert.equal(json.data?.empresa?.cnpj, '17422651000172');
    assert.equal(json.data?.empresa?.operation, 'created');
    assert.ok(typeof json.data?.empresa?.message === 'string');
  } finally {
    global.fetch = originalFetch;
    __setGetRequesterContextForTests(null);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('HTTP POST …/emitente — falha fase certificado inclui orchestrationPhase', async () => {
  const controller = await import('../src/controllers/mei-notas.controller.js');
  const { app, __setGetRequesterContextForTests } = await mountApp(controller);
  const originalFetch = global.fetch;

  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('127.0.0.1') || u.includes('localhost')) {
      return originalFetch(url, init);
    }
    if (u.includes('/certificado')) {
      return createJsonResponse(400, { message: 'Certificado inválido' });
    }
    return createJsonResponse(500, { message: 'unexpected' });
  };

  __setGetRequesterContextForTests(async () => ({ role: 'admin', mei: true }));

  const { server, port } = await listen(app);

  try {
    const body = new FormData();
    body.append('arquivo', new Blob([new Uint8Array([1])]), 'x.pfx');
    body.append('senha', 'p');
    body.append('payload', empresaPayloadMin());

    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/setup/emissao-fiscal/emitente`, {
      method: 'POST',
      body
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.errors?.orchestrationPhase, 'certificado');
    assert.ok(json.errors?.plugnotasRequest);
  } finally {
    global.fetch = originalFetch;
    __setGetRequesterContextForTests(null);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('HTTP POST …/emitente — falha fase empresa inclui orchestrationPhase', async () => {
  const controller = await import('../src/controllers/mei-notas.controller.js');
  const { app, __setGetRequesterContextForTests } = await mountApp(controller);
  const originalFetch = global.fetch;

  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('127.0.0.1') || u.includes('localhost')) {
      return originalFetch(url, init);
    }
    if (u.includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    if (u.includes('/certificado') && !u.includes('/empresa')) {
      return createJsonResponse(200, { message: 'OK', data: { id: 'cert-orch-2' } });
    }
    if (u.includes('/empresa') && init.method === 'POST') {
      return createJsonResponse(400, { message: 'Dados da empresa rejeitados' });
    }
    return createJsonResponse(500, { message: 'unexpected' });
  };

  __setGetRequesterContextForTests(async () => ({ role: 'admin', mei: true }));

  const { server, port } = await listen(app);

  try {
    const body = new FormData();
    body.append('arquivo', new Blob([new Uint8Array([1])]), 'x.pfx');
    body.append('senha', 'p');
    body.append('payload', empresaPayloadMin());

    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/setup/emissao-fiscal/emitente`, {
      method: 'POST',
      body
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.errors?.orchestrationPhase, 'empresa');
    assert.ok(json.errors?.plugnotasRequest);
  } finally {
    global.fetch = originalFetch;
    __setGetRequesterContextForTests(null);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('HTTP POST …/emitente — sucesso com documentosAtivos chama espelho (QA follow-up)', async () => {
  const controller = await import('../src/controllers/mei-notas.controller.js');
  const { app, __setGetRequesterContextForTests } = await mountApp(controller);
  const originalFetch = global.fetch;
  const mirrorCalls = [];

  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('127.0.0.1') || u.includes('localhost')) {
      return originalFetch(url, init);
    }
    if (u.includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    if (u.includes('/certificado') && !u.includes('/empresa')) {
      return createJsonResponse(200, { message: 'OK', data: { id: 'cert-doc-mirror' } });
    }
    if (u.includes('/empresa') && init.method === 'POST') {
      return createJsonResponse(200, {
        message: 'Cadastro efetuado com sucesso',
        data: { cnpj: '17422651000172' }
      });
    }
    return createJsonResponse(500, { message: 'unexpected url', url: u });
  };

  __setGetRequesterContextForTests(async () => ({ role: 'admin', mei: true }));
  controller.__setPersistDocumentosAtivosMirrorAfterEmitenteForTests(async (userId, payload) => {
    mirrorCalls.push({ userId, payload });
  });

  const { server, port } = await listen(app);

  try {
    const payloadJson = JSON.stringify({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Doc Mirror',
      endereco: {
        codigoCidade: '3550308',
        estado: 'SP',
        uf: 'SP',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cep: '01000000'
      },
      documentosAtivos: { nfse: true, nfe: false, nfce: false }
    });
    const body = new FormData();
    body.append('arquivo', new Blob([new Uint8Array([9])]), 'cert.pfx');
    body.append('senha', 'secret');
    body.append('payload', payloadJson);

    const res = await fetch(`http://127.0.0.1:${port}/api/mei-notas/setup/emissao-fiscal/emitente`, {
      method: 'POST',
      body
    });

    assert.equal(res.status, 200);
    assert.equal(mirrorCalls.length, 1);
    assert.equal(mirrorCalls[0].userId, 'emitente-composite-user');
    assert.deepEqual(mirrorCalls[0].payload.documentosAtivos, { nfse: true, nfe: false, nfce: false });
    assert.equal(mirrorCalls[0].payload.certificado, 'cert-doc-mirror');
  } finally {
    controller.__setPersistDocumentosAtivosMirrorAfterEmitenteForTests(null);
    global.fetch = originalFetch;
    __setGetRequesterContextForTests(null);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

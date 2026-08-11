import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import multer from 'multer';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import {
  requireFiscalPurchaseImport,
  __setGetRequesterContextForTests,
} from '../../src/middlewares/requireFiscalPurchaseImport.js';
import * as controller from '../../src/controllers/fiscal-purchase.controller.js';
import {
  __setPurchaseRepoForTests,
  __resetPurchaseRepoForTests,
  memoryRepository,
} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import {
  __setGetEmpresaFiscalDocForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase.repository.js';
import {
  __setLoadCatalogProductsForTests,
  __setAssertUserOwnsEmpresaForTests,
  __setCatalogDbForTests,
} from '../../src/fiscal-engine/acquisition/purchase-catalog.service.js';
import { DEFAULT_MAX_PURCHASE_XML_BYTES } from '../../src/fiscal-engine/acquisition/constants.js';
import { badRequest } from '../../src/utils/errors.js';
import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';

const createXmlUpload = (fileSizeLimit) => {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: fileSizeLimit } });
  return (req, res, next) => {
    upload.single('xml')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(badRequest('Arquivo XML excede o tamanho máximo permitido'));
      }
      if (err instanceof multer.MulterError) {
        return next(badRequest(err.message));
      }
      return next(err);
    });
  };
};

const EMP_ID = 'http-empresa-001';
const USER_ID = 'http-user-001';
const CNPJ = '12345678000199';

const listenApp = (app) => new Promise((resolve) => {
  const server = createServer(app);
  server.listen(0, () => resolve(server));
});

const injectAuth = (req, _res, next) => {
  req.user = { id: USER_ID };
  req.accessToken = 'token';
  next();
};

const buildMultipartBody = (xml, fields = {}) => {
  const boundary = '----fiscalboundary';
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="xml"; filename="nfe.xml"',
    'Content-Type: application/xml',
    '',
    xml,
  ];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}`,
      `Content-Disposition: form-data; name="${key}"`,
      '',
      String(value),
    );
  }
  parts.push(`--${boundary}--`, '');
  return {
    body: parts.join('\r\n'),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

const postImport = async (server, { xml, fields = {}, contextOverride = null }) => {
  __setGetRequesterContextForTests(async () => contextOverride || ({
    userId: USER_ID,
    empresaId: EMP_ID,
    role: 'admin',
  }));

  const { body, contentType } = buildMultipartBody(xml, fields);
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/import-xml`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: 'Bearer t' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

test.beforeEach(() => {
  __setGetRequesterContextForTests(null);
  __resetPurchaseRepoForTests();
  __setPurchaseRepoForTests(memoryRepository);
  __setGetEmpresaFiscalDocForTests(async () => CNPJ);
  __setLoadCatalogProductsForTests(async () => []);
  __setAssertUserOwnsEmpresaForTests(async () => {});
  __setCatalogDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 'cat-1', user_id: USER_ID }, error: null }),
          }),
        }),
      }),
    }),
  }));
});

test('HTTP multipart válido → 201', async () => {
  const app = express();
  app.post(
    '/import-xml',
    injectAuth,
    requireFiscalPurchaseImport,
    createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES),
    controller.importPurchaseXml,
  );
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('91000001') });
    const { status, json } = await postImport(server, { xml });
    assert.equal(status, 201);
    assert.equal(json.duplicate, false);
    assert.ok(json.invoice?.chave_nfe);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP permissão fiscal ausente → 403', async () => {
  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('91000002') });
    const { status } = await postImport(server, {
      xml,
      contextOverride: { userId: USER_ID, empresaId: EMP_ID, role: 'outsider' },
    });
    assert.equal(status, 403);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP XML malformado → 400', async () => {
  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const { status } = await postImport(server, { xml: '<root><bad' });
    assert.equal(status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP recipient mismatch → 422 blocked', async () => {
  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const xml = buildMinimalPurchaseNfeXml({
      chave: buildTestChaveNfe('91000003'),
      destCnpj: '99999999000199',
    });
    const { status, json } = await postImport(server, { xml });
    assert.equal(status, 422);
    assert.equal(json.blocked, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP upload acima do limite multer → 400', async () => {
  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(32), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('91000004') });
    const { status } = await postImport(server, { xml });
    assert.equal(status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP duplicidade → 200 duplicate', async () => {
  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);
  const ch = buildTestChaveNfe('91000005');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch });

  try {
    const first = await postImport(server, { xml });
    const second = await postImport(server, { xml });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.json.duplicate, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('HTTP produtoCatalogoId de outro tenant → 400', async () => {
  __setCatalogDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }));

  const app = express();
  app.post('/import-xml', injectAuth, requireFiscalPurchaseImport, createXmlUpload(DEFAULT_MAX_PURCHASE_XML_BYTES), controller.importPurchaseXml);
  app.use(errorHandler);
  const server = await listenApp(app);

  try {
    const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('91000006') });
    const { status } = await postImport(server, {
      xml,
      fields: { produtoCatalogoId: 'produto-outro-tenant' },
    });
    assert.equal(status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

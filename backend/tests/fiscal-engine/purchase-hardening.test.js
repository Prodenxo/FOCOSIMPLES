import test from 'node:test';

import assert from 'node:assert/strict';

import {

  verifyPurchaseNfeXmlSignature,

  markSignatureInvalidForTests,

} from '../../src/fiscal-engine/acquisition/purchase-xml-signature.js';

import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';

import {

  importPurchaseNfeXml,

  __resetPurchaseRepoForTests,

  __setPurchaseRepoForTests,

  memoryRepository,

} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';

import { SIGNATURE_STATUS } from '../../src/fiscal-engine/acquisition/constants.js';

import { SIGNATURE_REASON } from '../../src/fiscal-engine/acquisition/signature-constants.js';



const EMP = 'empresa-hardening';

const EMP_CNPJ = '12345678000199';



test.beforeEach(() => {

  __resetPurchaseRepoForTests();

  __setPurchaseRepoForTests(memoryRepository);

});



test('assinatura inválida → INVALID/CRYPTO_INVALID e lote BLOCKED', async () => {

  const ch = buildTestChaveNfe('60000001');

  const xml = markSignatureInvalidForTests(buildMinimalPurchaseNfeXml({ chave: ch }), `NFe${ch}`);

  const sig = verifyPurchaseNfeXmlSignature(xml, { infNfeId: `NFe${ch}` });

  assert.equal(sig.status, SIGNATURE_STATUS.INVALID);

  assert.equal(sig.reasonCode, SIGNATURE_REASON.CRYPTO_INVALID);



  const result = await importPurchaseNfeXml({

    empresaId: EMP,

    xmlBuffer: xml,

    empresaFiscalDoc: EMP_CNPJ,

    confirmedCatalogId: 'cat-x',

    confirmedCatalogProduct: { id: 'cat-x', metadata_json: {} },

  });

  assert.equal(result.invoice.signature_status, SIGNATURE_STATUS.INVALID);

  assert.equal(result.lots[0].status, 'BLOCKED');

  assert.ok(result.issues.some((i) => i.code === 'XML_SIGNATURE_INVALID'));

});



test('UNVERIFIED registra issue sem hard-block de import', async () => {

  const result = await importPurchaseNfeXml({

    empresaId: EMP,

    xmlBuffer: buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('60000002') }),

    empresaFiscalDoc: EMP_CNPJ,

  });

  assert.equal(result.blocked, false);

  assert.ok(result.issues.some((i) => i.code === 'XML_SIGNATURE_UNVERIFIED'));

});



test('digVal divergente do DigestValue → blocked PROTOCOL_DIGEST_MISMATCH', async () => {

  const ch = buildTestChaveNfe('60000003');

  const xml = markSignatureInvalidForTests(buildMinimalPurchaseNfeXml({

    chave: ch,

    digVal: 'ZGl2ZXJnZW50ZQ==',

  }), `NFe${ch}`);

  const result = await importPurchaseNfeXml({

    empresaId: EMP,

    xmlBuffer: xml,

    empresaFiscalDoc: EMP_CNPJ,

  });

  assert.equal(result.blocked, true);

  assert.ok(result.issues.some((i) => i.code === 'PROTOCOL_DIGEST_MISMATCH'));

});



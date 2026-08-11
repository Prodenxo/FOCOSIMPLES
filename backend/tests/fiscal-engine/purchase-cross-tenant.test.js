import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  importPurchaseNfeXml,
  __resetPurchaseRepoForTests,
  __setPurchaseRepoForTests,
  memoryRepository,
} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import { validateCatalogProductForEmpresa, __setCatalogDbForTests, __resetCatalogDbForTests, __setAssertUserOwnsEmpresaForTests } from '../../src/fiscal-engine/acquisition/purchase-catalog.service.js';
import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';
import { SIGNATURE_STATUS, STOCK_LOT_STATUS } from '../../src/fiscal-engine/acquisition/constants.js';
import { isStockLotUsable } from '../../src/fiscal-engine/acquisition/stock-lot.service.js';
import {
  verifyPurchaseNfeXmlSignature,
  markSignatureInvalidForTests,
  markSignatureVerificationErrorForTests,
} from '../../src/fiscal-engine/acquisition/purchase-xml-signature.js';
import { SIGNATURE_REASON } from '../../src/fiscal-engine/acquisition/signature-constants.js';

const EMP_A = 'empresa-a';
const EMP_B = 'empresa-b';
const CNPJ_A = '12345678000199';
const USER_A = 'user-a';
const USER_B = 'user-b';
const PRODUCT_B = 'produto-empresa-b';

test.beforeEach(() => {
  __resetPurchaseRepoForTests();
  __setPurchaseRepoForTests(memoryRepository);
  __resetCatalogDbForTests();
  __setAssertUserOwnsEmpresaForTests(async () => {});
});

test('assinatura ausente → UNVERIFIED / SIGNATURE_ABSENT', () => {
  const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('70000001') });
  const result = verifyPurchaseNfeXmlSignature(xml, { infNfeId: `NFe${buildTestChaveNfe('70000001')}` });
  assert.equal(result.status, SIGNATURE_STATUS.UNVERIFIED);
  assert.equal(result.reasonCode, SIGNATURE_REASON.SIGNATURE_ABSENT);
});

test('assinatura presente mas verificação inconclusa → UNVERIFIED / VERIFICATION_ERROR', () => {
  const ch = buildTestChaveNfe('70000002');
  const xml = markSignatureVerificationErrorForTests(buildMinimalPurchaseNfeXml({ chave: ch }));
  const result = verifyPurchaseNfeXmlSignature(xml, { infNfeId: `NFe${ch}` });
  assert.equal(result.status, SIGNATURE_STATUS.UNVERIFIED);
  assert.equal(result.reasonCode, SIGNATURE_REASON.VERIFICATION_ERROR);
});

test('verificação concluída e assinatura incorreta → INVALID / CRYPTO_INVALID', () => {
  const ch = buildTestChaveNfe('70000003');
  const xml = markSignatureInvalidForTests(buildMinimalPurchaseNfeXml({ chave: ch }), `NFe${ch}`);
  const result = verifyPurchaseNfeXmlSignature(xml, { infNfeId: `NFe${ch}` });
  assert.equal(result.status, SIGNATURE_STATUS.INVALID);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CRYPTO_INVALID);
});

test('UNVERIFIED persiste mas lote NÃO é utilizável (NEEDS_REVIEW)', async () => {
  const result = await importPurchaseNfeXml({
    empresaId: EMP_A,
    xmlBuffer: buildMinimalPurchaseNfeXml({
      chave: buildTestChaveNfe('70000004'),
      cStat: '100',
    }),
    empresaFiscalDoc: CNPJ_A,
    confirmedCatalogId: 'cat-a',
    confirmedCatalogProduct: { id: 'cat-a', metadata_json: {} },
  });
  assert.equal(result.blocked, false);
  assert.equal(result.invoice.signature_status, SIGNATURE_STATUS.UNVERIFIED);
  assert.equal(result.lots[0].status, STOCK_LOT_STATUS.NEEDS_REVIEW);
  assert.equal(isStockLotUsable(result.lots[0].status), false);
});

test('INVALID → lote BLOCKED e nunca utilizável', async () => {
  const ch = buildTestChaveNfe('70000005');
  const xml = markSignatureInvalidForTests(buildMinimalPurchaseNfeXml({ chave: ch }), `NFe${ch}`);
  const result = await importPurchaseNfeXml({
    empresaId: EMP_A,
    xmlBuffer: xml,
    empresaFiscalDoc: CNPJ_A,
    confirmedCatalogId: 'cat-a',
    confirmedCatalogProduct: { id: 'cat-a', metadata_json: {} },
  });
  assert.equal(result.lots[0].status, STOCK_LOT_STATUS.BLOCKED);
  assert.equal(isStockLotUsable(result.lots[0].status), false);
});

test('cross-tenant — Empresa B não consulta invoice da Empresa A', async () => {
  const ch = buildTestChaveNfe('80000001');
  await importPurchaseNfeXml({
    empresaId: EMP_A,
    xmlBuffer: buildMinimalPurchaseNfeXml({ chave: ch }),
    empresaFiscalDoc: CNPJ_A,
  });
  const cross = await memoryRepository.findInvoiceByChave(EMP_B, ch);
  assert.equal(cross, null);
});

test('cross-tenant — Empresa B não consome lote da Empresa A', async () => {
  const ch = buildTestChaveNfe('80000002');
  const imported = await importPurchaseNfeXml({
    empresaId: EMP_A,
    xmlBuffer: buildMinimalPurchaseNfeXml({ chave: ch }),
    empresaFiscalDoc: CNPJ_A,
    confirmedCatalogId: 'cat-a',
    confirmedCatalogProduct: { id: 'cat-a', metadata_json: {} },
  });
  const lotId = imported.lots[0].id;
  const consume = await memoryRepository.consumeStockLotQuantity(EMP_B, lotId, '1');
  assert.equal(consume.ok, false);
});

test('cross-tenant — produtoCatalogoId de outro usuário rejeitado', async () => {
  __setCatalogDbForTests(() => ({
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  }));

  await assert.rejects(
    () => validateCatalogProductForEmpresa({
      userId: USER_A,
      empresaId: EMP_A,
      produtoCatalogoId: PRODUCT_B,
    }),
    (err) => String(err?.message || err).includes('não pertence'),
  );
});

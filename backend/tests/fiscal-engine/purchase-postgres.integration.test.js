/**
 * Testes de integração Postgres — fiscal purchase repository.
 * Executados apenas quando DATABASE_URL/SUPABASE_DB_URL está configurado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../../src/config/env.js';
import { ensureFiscalPurchaseSchema, __resetFiscalPurchaseSchemaCacheForTests } from '../../src/fiscal-engine/acquisition/fiscal-purchase.schema.js';
import {
  findInvoiceByChave,
  savePurchaseImport,
  consumeStockLotQuantity,
  __deletePurchaseImportForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase.repository.js';
import {
  importPurchaseNfeXml,
  __resetPurchaseRepoForTests,
} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';
import { toDecimal } from '../../src/fiscal-engine/money/decimal.js';

const hasDb = Boolean(String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim());
const EMP_CNPJ = '12345678000199';

test.before(async () => {
  if (!hasDb) return;
  __resetFiscalPurchaseSchemaCacheForTests();
  await ensureFiscalPurchaseSchema({ force: true });
});

test.afterEach(async () => {
  __resetPurchaseRepoForTests();
});

test('postgres — import normal persiste invoice/items/lots', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const ch = buildTestChaveNfe('90000001');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch });

  const result = await importPurchaseNfeXml({
    empresaId,
    xmlBuffer: xml,
    empresaFiscalDoc: EMP_CNPJ,
    confirmedCatalogId: randomUUID(),
    confirmedCatalogProduct: { id: randomUUID(), metadata_json: {} },
  });

  assert.equal(result.duplicate, false);
  assert.ok(result.invoice.id);
  assert.equal(result.items.length, 1);
  assert.equal(result.lots.length, 1);

  const loaded = await findInvoiceByChave(empresaId, ch);
  assert.ok(loaded?.invoice?.id);

  await __deletePurchaseImportForTests(empresaId, ch);
});

test('postgres — reimport idempotente', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const ch = buildTestChaveNfe('90000002');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch });

  const r1 = await importPurchaseNfeXml({ empresaId, xmlBuffer: xml, empresaFiscalDoc: EMP_CNPJ });
  const r2 = await importPurchaseNfeXml({ empresaId, xmlBuffer: xml, empresaFiscalDoc: EMP_CNPJ });

  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, true);
  assert.equal(r1.invoice.id, r2.invoice.id);

  const count = await findInvoiceByChave(empresaId, ch);
  assert.equal(count.lots.length, 1);

  await __deletePurchaseImportForTests(empresaId, ch);
});

test('postgres — rollback quando save falha (hook pré-save)', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const ch = buildTestChaveNfe('90000003');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch });

  await assert.rejects(
    () => importPurchaseNfeXml({
      empresaId,
      xmlBuffer: xml,
      empresaFiscalDoc: EMP_CNPJ,
      __testHooks: { failAfterInvoice: true },
    }),
    /ROLLBACK_TEST_HOOK/,
  );

  const loaded = await findInvoiceByChave(empresaId, ch);
  assert.equal(loaded, null);
});

test('postgres — concorrência consume não permite negativo', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const ch = buildTestChaveNfe('90000004');
  const result = await importPurchaseNfeXml({
    empresaId,
    xmlBuffer: buildMinimalPurchaseNfeXml({
      chave: ch,
      items: [{ qCom: '4.0000', qTrib: '4.0000' }],
    }),
    empresaFiscalDoc: EMP_CNPJ,
    confirmedCatalogId: randomUUID(),
    confirmedCatalogProduct: { id: randomUUID(), metadata_json: {} },
  });

  const lotId = result.lots[0].id;
  const ok = await consumeStockLotQuantity(empresaId, lotId, '2.0000000000');
  assert.equal(ok.ok, true);

  const fail = await consumeStockLotQuantity(empresaId, lotId, '3.0000000000');
  assert.equal(fail.ok, false);

  await __deletePurchaseImportForTests(empresaId, ch);
});

test('postgres — savePurchaseImport transacional via duplicate race', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const ch = buildTestChaveNfe('90000005');
  const invoice = {
    empresa_id: empresaId,
    chave_nfe: ch,
    inf_nfe_id: `NFe${ch}`,
    modelo: 55,
    serie: '1',
    numero: '1',
    document_status: 'AUTHORIZED',
    authorization_status: 'AUTHORIZED',
    event_status: 'NOT_CHECKED',
    signature_status: 'UNVERIFIED',
    xml_sha256: 'abc',
    parser_version: '1.0.0',
  };
  const items = [{ numero_item: 1, origem: '0', prior_st_status: 'NO_ST_EVIDENCE', catalog_match_status: 'UNMATCHED' }];
  const lots = [{
    empresa_id: empresaId,
    origem_mercadoria: '0',
    base_unit: 'UN',
    quantidade_inicial: '1',
    quantidade_disponivel: '1',
    prior_st_status: 'NO_ST_EVIDENCE',
    data_entrada: '2026-01-15',
    status: 'PENDING_CATALOG_MATCH',
  }];

  const s1 = await savePurchaseImport({ invoice, items, lots });
  const s2 = await savePurchaseImport({ invoice, items, lots });
  assert.equal(s1.duplicate, false);
  assert.equal(s2.duplicate, true);

  await __deletePurchaseImportForTests(empresaId, ch);
});

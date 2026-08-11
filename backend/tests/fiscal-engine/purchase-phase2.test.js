import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePurchaseNfeXml } from '../../src/fiscal-engine/acquisition/purchase-xml-parser.js';
import { validateChaveNFe } from '../../src/fiscal-engine/acquisition/purchase-xml-validator.js';
import { classifyPriorStFromIcmsGroups } from '../../src/fiscal-engine/acquisition/acquisition-classifier.js';
import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';
import {
  importPurchaseNfeXml,
  __resetPurchaseRepoForTests,
  __setPurchaseRepoForTests,
  memoryRepository,
} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import { allocateStRetainedValues } from '../../src/fiscal-engine/acquisition/st-retained-allocator.js';
import { buildUnitConversionEvidence } from '../../src/fiscal-engine/acquisition/unit-conversion.js';
import { resolveStockUnit } from '../../src/fiscal-engine/acquisition/stock-unit-resolution.js';
import { validatePurchaseRecipient } from '../../src/fiscal-engine/acquisition/purchase-recipient-validator.js';
import { ST_ALLOCATION_METHOD } from '../../src/fiscal-engine/types/st-allocation.js';
import { AUTHORIZATION_STATUS } from '../../src/fiscal-engine/acquisition/constants.js';
import { toDecimal } from '../../src/fiscal-engine/money/decimal.js';

const EMP = 'empresa-test-001';
const EMP_CNPJ = '12345678000199';

const importXml = (xml, opts = {}) => importPurchaseNfeXml({
  empresaId: EMP,
  xmlBuffer: xml,
  empresaFiscalDoc: EMP_CNPJ,
  ...opts,
});

test.beforeEach(() => {
  __resetPurchaseRepoForTests();
  __setPurchaseRepoForTests(memoryRepository);
});

test('buildTestChaveNfe gera chave válida', () => {
  const ch = buildTestChaveNfe('87654321');
  assert.equal(validateChaveNFe(ch).ok, true);
});

test('compra sem ST → NO_ST_EVIDENCE', async () => {
  const ch = buildTestChaveNfe('10000001');
  const xml = buildMinimalPurchaseNfeXml({
    chave: ch,
    items: [{ ncm: '22021000', icmsXml: '<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>' }],
  });
  const parsed = parsePurchaseNfeXml(xml);
  const cls = classifyPriorStFromIcmsGroups(parsed.items[0].parsedTax.icmsGroups);
  assert.equal(cls.priorStStatus, 'NO_ST_EVIDENCE');
});

test('CST 60 / ICMSSN500 com vBCSTRet → RETAINED (ST anterior)', async () => {
  const icms60 = '<ICMS60><orig>0</orig><CST>60</CST><vBCSTRet>100.00</vBCSTRet><vICMSSTRet>18.00</vICMSSTRet></ICMS60>';
  const cls = classifyPriorStFromIcmsGroups([{
    groupTag: 'ICMS60',
    priorRetained: { vBCSTRet: '100.00', vICMSSTRet: '18.00' },
    operationSt: null,
  }]);
  assert.equal(cls.priorStStatus, 'RETAINED');
  assert.equal(cls.documentClassification, 'PRIOR_RETAINED');

  const icms500 = '<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN><vBCSTRet>200.00</vBCSTRet><vICMSSTRet>36.00</vICMSSTRet></ICMSSN500>';
  const ch = buildTestChaveNfe('10000002');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch, items: [{ ncm: '40111000', icmsXml: icms500 }] });
  const parsed = parsePurchaseNfeXml(xml);
  const c2 = classifyPriorStFromIcmsGroups(parsed.items[0].parsedTax.icmsGroups);
  assert.equal(c2.priorStStatus, 'RETAINED');
});

test('CST 10 / CSOSN 202 — ST cobrada na compra → RETAINED', async () => {
  const icms10 = '<ICMS10><orig>0</orig><CST>10</CST><vBCST>50.00</vBCST><vICMSST>9.00</vICMSST></ICMS10>';
  const ch = buildTestChaveNfe('10000003');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch, items: [{ icmsXml: icms10 }] });
  const parsed = parsePurchaseNfeXml(xml);
  assert.equal(classifyPriorStFromIcmsGroups(parsed.items[0].parsedTax.icmsGroups).priorStStatus, 'RETAINED');

  const sn202 = '<ICMSSN202><orig>0</orig><CSOSN>202</CSOSN><vBCST>80.00</vBCST><vICMSST>14.40</vICMSST></ICMSSN202>';
  const xml2 = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('10000004'), items: [{ icmsXml: sn202 }] });
  const p2 = parsePurchaseNfeXml(xml2);
  assert.equal(classifyPriorStFromIcmsGroups(p2.items[0].parsedTax.icmsGroups).priorStStatus, 'RETAINED');
});

test('ST ambígua — prior + operation → UNKNOWN', () => {
  const cls = classifyPriorStFromIcmsGroups([{
    groupTag: 'ICMS60',
    priorRetained: { vICMSSTRet: '1.00' },
    operationSt: { vICMSST: '2.00' },
  }]);
  assert.equal(cls.priorStStatus, 'UNKNOWN');
  assert.equal(cls.documentClassification, 'AMBIGUOUS');
});

test('origem nacional vs importada — nunca default 0 silencioso', () => {
  const ch = buildTestChaveNfe('10000005');
  const xml = buildMinimalPurchaseNfeXml({
    chave: ch,
    items: [{ icmsXml: '<ICMSSN102><orig>2</orig><CSOSN>102</CSOSN></ICMSSN102>' }],
  });
  const parsed = parsePurchaseNfeXml(xml);
  assert.equal(parsed.items[0].commercial.origem, '2');
});

test('qCom=qTrib vs qCom!=qTrib', () => {
  const same = resolveStockUnit({ uCom: 'UN', qCom: '10', uTrib: 'UN', qTrib: '10' });
  assert.equal(same.status, 'CONFIRMED');
  assert.equal(same.source, 'DIRECT_DOCUMENT');

  const diff = resolveStockUnit({ uCom: 'UN', qCom: '10', uTrib: 'UN', qTrib: '9' });
  assert.equal(diff.status, 'NEEDS_REVIEW');

  const cx = resolveStockUnit({ uCom: 'CX', qCom: '2', uTrib: 'UN', qTrib: '24' });
  assert.equal(cx.status, 'NEEDS_REVIEW');
  assert.equal(buildUnitConversionEvidence({ uCom: 'CX', qCom: '2', uTrib: 'UN', qTrib: '24' }).stockBasis, 'CONVERSION_REQUIRED');
});

test('XML sem protocolo → authorization UNKNOWN e lote NEEDS_REVIEW', async () => {
  const ch = buildTestChaveNfe('10000006');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch, withProtocol: false });
  const result = await importXml(xml);
  assert.equal(result.invoice.authorization_status, 'UNKNOWN');
  assert.equal(result.invoice.event_status, 'NOT_CHECKED');
  assert.equal(result.lots[0].status, 'NEEDS_REVIEW');
});

test('autorização cStat 100 → AUTHORIZED + eventStatus NOT_CHECKED', async () => {
  const ch = buildTestChaveNfe('10000010');
  const result = await importXml(buildMinimalPurchaseNfeXml({ chave: ch, cStat: '100' }));
  assert.equal(result.invoice.authorization_status, AUTHORIZATION_STATUS.AUTHORIZED);
  assert.equal(result.invoice.event_status, 'NOT_CHECKED');
});

test('idempotência — reimport não duplica estoque', async () => {
  const ch = buildTestChaveNfe('10000007');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch });
  const r1 = await importXml(xml);
  const r2 = await importXml(xml);
  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, true);
  assert.equal(r1.invoice.chave_nfe, r2.invoice.chave_nfe);
  assert.equal(r1.lots.length, r2.lots.length);
});

test('produto não vinculado → PENDING_CATALOG_MATCH', async () => {
  const ch = buildTestChaveNfe('10000008');
  const result = await importXml(buildMinimalPurchaseNfeXml({ chave: ch }), { catalogProducts: [] });
  assert.equal(result.lots[0].status, 'PENDING_CATALOG_MATCH');
});

test('mesmo SKU aquisições diferentes — chaves distintas, priorSt distinto', async () => {
  const ch1 = buildTestChaveNfe('20000001');
  const ch2 = buildTestChaveNfe('20000002');
  const r1 = await importXml(buildMinimalPurchaseNfeXml({
    chave: ch1,
    items: [{ ncm: '40111000', icmsXml: '<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>' }],
  }));
  const r2 = await importXml(buildMinimalPurchaseNfeXml({
    chave: ch2,
    items: [{
      ncm: '40111000',
      icmsXml: '<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN><vBCSTRet>100.00</vBCSTRet><vICMSSTRet>18.00</vICMSSTRet></ICMSSN500>',
    }],
  }));
  assert.equal(r1.items[0].prior_st_status, 'NO_ST_EVIDENCE');
  assert.equal(r2.items[0].prior_st_status, 'RETAINED');
});

test('rateio Decimal proporcional ST', () => {
  const alloc = allocateStRetainedValues({
    purchaseValues: { vICMSSTRet: '100.00', vBCSTRet: '500.00' },
    purchaseTotalQty: '10',
    allocatedQty: '3',
    remainingQty: '7',
    method: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
  });
  assert.equal(alloc.ok, true);
  assert.equal(alloc.allocatedValues.vICMSSTRet, '30.00');
  assert.equal(alloc.allocatedValues.vBCSTRet, '150.00');
});

test('RULE_DEFINED allocator → NEEDS_REVIEW', () => {
  const alloc = allocateStRetainedValues({
    purchaseValues: { vICMSSTRet: '100.00' },
    purchaseTotalQty: '10',
    allocatedQty: '3',
    remainingQty: '7',
    method: ST_ALLOCATION_METHOD.RULE_DEFINED,
  });
  assert.equal(alloc.ok, false);
  assert.equal(alloc.issues[0].code, 'ST_ALLOCATION_STRATEGY_MISSING');
});

test('MANUAL_VALIDATED allocator → NEEDS_REVIEW', () => {
  const alloc = allocateStRetainedValues({
    purchaseValues: { vICMSSTRet: '100.00' },
    purchaseTotalQty: '10',
    allocatedQty: '3',
    remainingQty: '7',
    method: ST_ALLOCATION_METHOD.MANUAL_VALIDATED,
  });
  assert.equal(alloc.ok, false);
  assert.equal(alloc.issues[0].code, 'ST_ALLOCATION_STRATEGY_MISSING');
});

test('concorrência estoque — não permite negativo', async () => {
  const ch = buildTestChaveNfe('10000009');
  const result = await importXml(buildMinimalPurchaseNfeXml({
    chave: ch,
    items: [{ qCom: '5.0000', qTrib: '5.0000' }],
  }), {
    confirmedCatalogId: 'cat-1',
    confirmedCatalogProduct: { id: 'cat-1', metadata_json: {} },
  });
  const lotId = result.lots[0].id;
  const ok = await memoryRepository.consumeStockLotQuantity(EMP, lotId, '3');
  assert.equal(ok.ok, true);
  assert.ok(toDecimal(ok.lot.quantidade_disponivel).eq(2));
  const fail = await memoryRepository.consumeStockLotQuantity(EMP, lotId, '5');
  assert.equal(fail.ok, false);
});

test('pneu NCM 40111000 fixture genérica — RETAINED com ST anterior', async () => {
  const ch = buildTestChaveNfe('40111000');
  const xml = buildMinimalPurchaseNfeXml({
    chave: ch,
    items: [{
      ncm: '40111000',
      cest: '0100100',
      xProd: 'Pneu novo automóvel',
      icmsXml: '<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN><vBCSTRet>250.00</vBCSTRet><vICMSSTRet>45.00</vICMSSTRet><pST>18.00</pST></ICMSSN500>',
    }],
  });
  const result = await importXml(xml);
  assert.equal(result.items[0].ncm, '40111000');
  assert.equal(result.items[0].prior_st_status, 'RETAINED');
  assert.equal(result.items[0].supplier_cest, '0100100');
  assert.ok(result.lots[0].audit_explain?.reason);
});

test('com e sem CEST — supplierCest como evidência SUPPLIER_CEST_EVIDENCE', async () => {
  const withCest = await importXml(buildMinimalPurchaseNfeXml({
    chave: buildTestChaveNfe('30000001'),
    items: [{ cest: '0300100' }],
  }));
  assert.equal(withCest.items[0].supplier_cest, '0300100');
  assert.ok(withCest.items[0].issues_json.some((i) => i.code === 'SUPPLIER_CEST_EVIDENCE'));

  const noCest = await importXml(buildMinimalPurchaseNfeXml({
    chave: buildTestChaveNfe('30000002'),
    items: [{}],
  }));
  assert.equal(noCest.items[0].supplier_cest, null);
});

test('recipient mismatch → bloqueado PURCHASE_RECIPIENT_MISMATCH', async () => {
  const ch = buildTestChaveNfe('40000001');
  const xml = buildMinimalPurchaseNfeXml({ chave: ch, destCnpj: '99999999000199' });
  const result = await importXml(xml, { empresaFiscalDoc: EMP_CNPJ });
  assert.equal(result.blocked, true);
  assert.equal(result.invoice, null);
  assert.ok(result.issues.some((i) => i.code === 'PURCHASE_RECIPIENT_MISMATCH'));
});

test('chave com DV inválido → rejeitada no parser', () => {
  const valid = buildTestChaveNfe('50000001');
  const invalid = `${valid.slice(0, 43)}${valid[43] === '0' ? '9' : '0'}`;
  assert.throws(
    () => parsePurchaseNfeXml(buildMinimalPurchaseNfeXml({ chave: invalid })),
    /Dígito verificador|inválido/i,
  );
});

test('CX→UN não confirmado → lote NEEDS_REVIEW', async () => {
  const ch = buildTestChaveNfe('50000002');
  const result = await importXml(buildMinimalPurchaseNfeXml({
    chave: ch,
    items: [{ uCom: 'CX', qCom: '1.0000', uTrib: 'UN', qTrib: '10.0000' }],
  }), {
    confirmedCatalogId: 'cat-2',
    confirmedCatalogProduct: { id: 'cat-2', metadata_json: {} },
  });
  assert.equal(result.lots[0].status, 'NEEDS_REVIEW');
  assert.equal(result.lots[0].stock_unit_resolution_json.status, 'NEEDS_REVIEW');
});

test('validatePurchaseRecipient — destinatário correto', () => {
  const ok = validatePurchaseRecipient({
    destinatarioDoc: EMP_CNPJ,
    empresaFiscalDoc: EMP_CNPJ,
  });
  assert.equal(ok.ok, true);
});

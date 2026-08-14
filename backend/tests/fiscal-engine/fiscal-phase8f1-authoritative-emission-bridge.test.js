/**
 * Fase 8F.1 — bridge authoritative AccountantApproved → PlugNotas tributos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  __withFiscalEngineFlagsForTests,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  resolveFiscalFromContextWithAccountantConfig,
  resolveAuthoritativeFiscalFromContexts,
  buildAuthoritativeNfePayloadFromFiscalResults,
  applyAuthoritativePlugnotasTributosBridge,
  mapFiscalV3IcmsToPlugnotasTributos,
  mapFiscalV3PisCofinsToPlugnotasTributos,
  evaluatePlugnotasNfeTaxBridgeCapability,
  runAuthoritativePreflightPostReservation,
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  PIS_COFINS_CALCULATION_MODES,
  resolveNfeEmitPayloadForPlugnotas,
  evaluateAuthorityDecision,
  evaluateAuthoritativeEmissionRouting,
  prepareFiscalAuthorityRouting,
  hasAuthoritativeAccountantConfigReadiness,
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
  AUTHORITY_DECISION_REASON,
  ROLLOUT_MODE,
  DEFAULT_RESOLVER_OPTIONS,
  normalizeResolverOptions,
} from '../../src/fiscal-engine/index.js';
import { bootstrapPhase8cFixtures, PHASE8C_TENANT_ID, PHASE8C_PRODUCT_ID } from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import { validateNfeLikePayload } from '../../src/lib/nfe-like-payload-validate.js';
import { normalizePlugnotasNfePayload } from '../../src/services/plugnotas/plugnotas-nfe-payload.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../../src/lib/nfe-like-payload-tax-apply.js';
import { AUTHORITY_ENGINE } from '../../src/fiscal-engine/rollout/rollout-constants.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import {
  __getLotsByIdMapForTests,
  __resetFiscalPurchaseMemoryRepo,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase-memory.repository.js';

const TENANT = PHASE8C_TENANT_ID;

const STD_CONDITIONS = {
  crt: [1],
  operationType: ['VENDA'],
  operationScope: ['INTERNAL'],
  itemSource: ['THIRD_PARTY'],
  recipientTaxpayerStatus: ['NON_TAXPAYER'],
  priorStStatus: ['NO_ST_EVIDENCE'],
  issuerUf: ['RJ'],
  destinationUf: ['RJ'],
};

const ntPis = (cst = '07') => ({ cst });
const ntCofins = (cst = '08') => ({ cst });

const outrZeroPis = (cst = '49', pPIS = '0') => ({
  cst,
  calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
  pPIS,
});

const outrZeroCofins = (cst = '49', pCOFINS = '0') => ({
  cst,
  calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
  pCOFINS,
});

const approvedBase = (overrides = {}) => ({
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
  pis: ntPis(),
  cofins: ntCofins(),
  ...overrides,
});

const insertRule = (id, approvedOverrides = {}, conditionOverrides = {}) => {
  insertApprovedRuleForFixture({
    id,
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: { ...STD_CONDITIONS, ...conditionOverrides },
    approvedResult: approvedBase(approvedOverrides),
    validFrom: '2020-01-01',
    approvedBy: 'acc-8f1',
  });
};

const ctxBase = () => buildTestFiscalContext({
  empresaId: TENANT,
  allocation: {
    empresa_id: TENANT,
    prior_st_status: 'NO_ST_EVIDENCE',
    origem_mercadoria: '0',
  },
  issuer: { crt: 1, uf: 'RJ' },
  recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
  operation: { destinationUf: 'RJ', tipo: 'VENDA' },
  produto: { ncm: '22021000', produtoCatalogoId: PHASE8C_PRODUCT_ID },
  item: { itemSource: 'THIRD_PARTY', quantidade: 2, valorUnitario: 50 },
  referenceDate: '2026-06-15',
});

const commercialPayloadMinimal = (staleTributos = null) => ({
  emitente: {
    cpfCnpj: '12345678000199',
    crt: 1,
    endereco: { estado: 'RJ' },
  },
  destinatario: {
    cpfCnpj: '12345678901',
    razaoSocial: 'Cliente Teste',
    indIEDest: '9',
    endereco: {
      cep: '20040020',
      logradouro: 'Rua Teste',
      numero: '100',
      bairro: 'Centro',
      codigoCidade: '3304557',
      descricaoCidade: 'Rio de Janeiro',
      estado: 'RJ',
    },
  },
  natureza: 'VENDA',
  itens: [{
    codigo: 'SKU-8F1',
    descricao: 'Produto bridge',
    ncm: '22021000',
    cfop: '9999',
    unidade: 'UN',
    quantidade: '2.0000',
    valorUnitario: '50.00',
    valorTotal: '100.00',
    produtoCatalogoId: PHASE8C_PRODUCT_ID,
    itemSource: 'THIRD_PARTY',
    commercialSaleItemId: 'csi-8f1-minimal',
    ...(staleTributos ? { tributos: staleTributos } : {}),
  }],
});

const seedLotForRouting = () => {
  const lot = buildUsableStockLot({
    empresaId: TENANT,
    produtoCatalogoId: PHASE8C_PRODUCT_ID,
    quantidade: '10.0000000000',
    origem: '0',
  });
  __getLotsByIdMapForTests().set(lot.id, lot);
  return lot;
};

const authoritativeRoutingParams = (lot) => ({
  empresaId: TENANT,
  userId: TENANT,
  documentType: 'NFE',
  businessType: 'RESELLER',
  legacyPayload: commercialPayloadMinimal(),
  meiNotaRecordId: 'hard-routing-emit',
  inMemoryLotsByProduct: { [PHASE8C_PRODUCT_ID]: [lot] },
});

const resolveAndBridge = async (approvedOverrides = {}) => {
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayloadMinimal(),
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2', id: 'lot-bridge' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2' }],
      fiscalResults: [fiscalResult],
    }],
  });
  return { fiscalResult, built, bridged };
};

const hashPayload = (payload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

test.beforeEach(() => {
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
  __resetRolloutPolicyMemoryForTests();
  __resetFiscalPurchaseMemoryRepo();
});

test('8F1-BRIDGE-01: authoritative usa accountant config', async () => {
  insertRule('bridge-01');
  const [result] = await resolveAuthoritativeFiscalFromContexts([ctxBase()]);
  assert.equal(result.audit?.accountantConfig?.accountantApprovedRuleId, 'bridge-01');
  assert.equal(result.audit?.pipeline, 'fiscal-engine-v3.1-phase-8c');
});

test('8F1-BRIDGE-02: CFOP do contador chega ao payload', async () => {
  insertRule('bridge-02', { cfop: '5102' });
  const { bridged } = await resolveAndBridge();
  assert.equal(bridged.ok, true);
  assert.equal(bridged.payload.itens[0].cfop, '5102');
});

test('8F1-BRIDGE-03: CSOSN102 canonical → PlugNotas', async () => {
  insertRule('bridge-03');
  const { fiscalResult } = await resolveAndBridge();
  const icmsCanonical = fiscalResult.resolutions.xmlFields.taxes.icms;
  const plugIcms = mapFiscalV3IcmsToPlugnotasTributos(icmsCanonical);
  assert.equal(plugIcms.origem, '0');
  assert.equal(plugIcms.csosn, '102');
});

test('8F1-BRIDGE-04: PIS NT canonical → PlugNotas', async () => {
  insertRule('bridge-04', { pis: ntPis('07') });
  const { fiscalResult } = await resolveAndBridge();
  const plugPis = mapFiscalV3PisCofinsToPlugnotasTributos(
    fiscalResult.resolutions.xmlFields.taxes.pis,
    'pis',
  );
  assert.equal(plugPis.cst, '07');
  assert.deepEqual(Object.keys(plugPis).sort(), ['cst']);
});

test('8F1-BRIDGE-05: COFINS NT canonical → PlugNotas', async () => {
  insertRule('bridge-05', { cofins: ntCofins('08') });
  const { fiscalResult } = await resolveAndBridge();
  const plugCofins = mapFiscalV3PisCofinsToPlugnotasTributos(
    fiscalResult.resolutions.xmlFields.taxes.cofins,
    'cofins',
  );
  assert.equal(plugCofins.cst, '08');
});

test('8F1-BRIDGE-06: PIS OUTR_ZERO explícito → PlugNotas', async () => {
  insertRule('bridge-06', { pis: outrZeroPis('49', '0') });
  const { fiscalResult, bridged } = await resolveAndBridge();
  const plugPis = bridged.payload.itens[0].tributos.pis;
  assert.equal(plugPis.cst, '49');
  assert.equal(plugPis.aliquota, 0);
  assert.equal(plugPis.valor, 0);
  assert.ok(fiscalResult.resolutions.xmlFields.taxes.pis);
});

test('8F1-BRIDGE-07: COFINS OUTR_ZERO explícito → PlugNotas', async () => {
  insertRule('bridge-07', { cofins: outrZeroCofins('99', '0') });
  const { bridged } = await resolveAndBridge();
  const plugCofins = bridged.payload.itens[0].tributos.cofins;
  assert.equal(plugCofins.cst, '99');
  assert.equal(plugCofins.aliquota, 0);
  assert.equal(plugCofins.valor, 0);
});

test('8F1-BRIDGE-08: zero explícito preservado', async () => {
  insertRule('bridge-08', { pis: outrZeroPis('49', '0'), cofins: outrZeroCofins('49', '0') });
  const { bridged } = await resolveAndBridge();
  assert.strictEqual(bridged.payload.itens[0].tributos.pis.valor, 0);
  assert.strictEqual(bridged.payload.itens[0].tributos.cofins.valor, 0);
  assert.strictEqual(bridged.payload.itens[0].tributos.pis.aliquota, 0);
});

test('8F1-BRIDGE-09: bridge não inventa zero ausente', () => {
  assert.throws(
    () => mapFiscalV3PisCofinsToPlugnotasTributos({
      group: 'PISOutr',
      fields: { CST: '49', vBC: '10.00' },
    }, 'pis'),
    /pPIS ausente/,
  );
});

test('8F1-BRIDGE-10: stale ICMS legacy sobrescrito', async () => {
  insertRule('bridge-10');
  const stale = {
    icms: { csosn: '999', origem: '8' },
    pis: { cst: '49', baseCalculo: { valor: 99 }, aliquota: 99, valor: 99 },
    cofins: { cst: '49', baseCalculo: { valor: 99 }, aliquota: 99, valor: 99 },
  };
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayloadMinimal(stale),
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2', id: 'lot-stale' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups: [{ fiscalResults: [fiscalResult] }],
  });
  assert.equal(bridged.payload.itens[0].tributos.icms.csosn, '102');
  assert.notEqual(bridged.payload.itens[0].tributos.icms.origem, '8');
});

test('8F1-BRIDGE-11: stale PIS legacy sobrescrito', async () => {
  insertRule('bridge-11');
  const stale = {
    icms: { csosn: '999' },
    pis: { cst: '49', baseCalculo: { valor: 88 }, aliquota: 88, valor: 88 },
    cofins: { cst: '08', baseCalculo: { valor: 0 }, aliquota: 0, valor: 0 },
  };
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayloadMinimal(stale),
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups: [{ fiscalResults: [fiscalResult] }],
  });
  assert.equal(bridged.payload.itens[0].tributos.pis.cst, '07');
  assert.notEqual(bridged.payload.itens[0].tributos.pis.valor, 88);
});

test('8F1-BRIDGE-12: stale COFINS legacy sobrescrito', async () => {
  insertRule('bridge-12');
  const stale = {
    icms: { csosn: '999' },
    pis: { cst: '07', baseCalculo: { valor: 0 }, aliquota: 0, valor: 0 },
    cofins: { cst: '99', baseCalculo: { valor: 77 }, aliquota: 77, valor: 77 },
  };
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayloadMinimal(stale),
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups: [{ fiscalResults: [fiscalResult] }],
  });
  assert.equal(bridged.payload.itens[0].tributos.cofins.cst, '08');
});

test('8F1-BRIDGE-13: validateNfeLikePayload passa', async () => {
  insertRule('bridge-13');
  const { bridged } = await resolveAndBridge();
  const normalized = normalizePlugnotasNfePayload(bridged.payload);
  assert.doesNotThrow(() => validateNfeLikePayload(normalized, { label: 'NF-e' }));
});

test('8F1-BRIDGE-14: normalizePlugnotasNfePayload preserva fiscal V3', async () => {
  insertRule('bridge-14');
  const { bridged } = await resolveAndBridge();
  const before = bridged.payload.itens[0].tributos;
  const normalized = normalizePlugnotasNfePayload(bridged.payload);
  const after = normalized.itens[0].tributos;
  assert.equal(after.icms.cst ?? after.icms.csosn, before.icms.csosn);
  assert.equal(after.pis.cst, before.pis.cst);
  assert.equal(after.cofins.cst, before.cofins.cst);
  assert.equal(after.pis.valor ?? 0, before.pis.valor ?? 0);
});

test('8F1-BRIDGE-15: accountant config não executable bloqueia', async () => {
  insertRule('bridge-15', {
    pis: { cst: '01', pPIS: '1.65' },
    cofins: ntCofins(),
  });
  const [result] = await resolveAuthoritativeFiscalFromContexts([ctxBase()]);
  assert.ok(result.issues.some((i) => i.code === 'ACCOUNTANT_RULE_NOT_EXECUTABLE'));
  const cap = evaluatePlugnotasNfeTaxBridgeCapability(result);
  assert.equal(cap.ok, false);
});

test('8F1-BRIDGE-16: legacy path permanece intacto', async () => {
  const legacyPayload = {
    emitente: { cpfCnpj: '12345678000199', endereco: { estado: 'RJ', uf: 'RJ' } },
    destinatario: { cpfCnpj: '12345678901', endereco: { estado: 'RJ', uf: 'RJ' } },
    itens: [{
      ncm: '22021000',
      cfop: '5102',
      tributos: {
        icms: { csosn: '102' },
        pis: { cst: '07' },
        cofins: { cst: '08' },
      },
    }],
  };
  let legacyTransformCalled = false;
  const resolved = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: TENANT,
    documentType: 'NFE',
    commercialPayload: legacyPayload,
    applyLegacyFiscalTransform: async (p) => {
      legacyTransformCalled = true;
      return recalculateNfeLikePayloadTaxForEmit(p, { businessType: 'RESELLER' });
    },
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(resolved.engine, AUTHORITY_ENGINE.LEGACY);
  assert.equal(resolved.legacyFiscalApplied, true);
  assert.equal(legacyTransformCalled, true);
  assert.equal(resolved.authorityAssumed, false);
});

test('8F1-BRIDGE-17: flags continuam OFF', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('8F1-BRIDGE-18: nenhum HTTP PlugNotas executado', async () => {
  insertRule('bridge-18');
  const { bridged } = await resolveAndBridge();
  const normalized = normalizePlugnotasNfePayload(bridged.payload);
  validateNfeLikePayload(normalized, { label: 'NF-e' });
  assert.ok(normalized.itens[0].tributos.icms);
});

test('8F1-BRIDGE-19: mesmo input gera mesmo payload provider', async () => {
  insertRule('bridge-19');
  const run = async () => {
    const { bridged } = await resolveAndBridge();
    const normalized = normalizePlugnotasNfePayload(bridged.payload);
    return normalized.itens[0].tributos;
  };
  const h1 = hashPayload(await run());
  const h2 = hashPayload(await run());
  assert.equal(h1, h2);
});

test('8F1-BRIDGE-20: não existe mistura V3 + fiscal stale legacy', async () => {
  insertRule('bridge-20');
  const stale = {
    icms: { csosn: '500', origem: '2' },
    pis: { cst: '49', baseCalculo: { valor: 1 }, aliquota: 1, valor: 1 },
    cofins: { cst: '49', baseCalculo: { valor: 1 }, aliquota: 1, valor: 1 },
  };
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayloadMinimal(stale),
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups: [{ fiscalResults: [fiscalResult] }],
  });
  const item = bridged.payload.itens[0];
  assert.equal(item.impostos?.icms?.CSOSN, '102');
  assert.equal(item.tributos.icms.csosn, '102');
  assert.equal(item.tributos.pis.cst, '07');
  assert.notEqual(item.tributos.icms.csosn, stale.icms.csosn);
  assert.notEqual(item.tributos.pis.valor, stale.pis.valor);

  const postPreflight = await runAuthoritativePreflightPostReservation({
    empresaId: TENANT,
    businessType: 'RESELLER',
    legacyPayload: commercialPayloadMinimal(stale),
    reservedAllocations: [{
      commercialItemIndex: 0,
      commercialItem: { quantidade: '2', commercialSaleItemId: 'csi-20' },
      allocations: [{
        quantidade: '2',
        origem_mercadoria: '0',
        prior_st_status: 'NO_ST_EVIDENCE',
        commercial_sale_item_id: 'csi-20',
      }],
    }],
    requestedQuantities: [{ commercialSaleItemId: 'csi-20', quantidade: '2' }],
  });
  assert.ok(postPreflight.fiscalResults[0]?.audit?.accountantConfig?.accountantApprovedRuleId);
});

test('8F1-HARD-01: V3 OFF → legacy continua permitido', async () => {
  insertRule('hard-01');
  let legacyCalled = false;
  const result = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: TENANT,
    documentType: 'NFE',
    commercialPayload: commercialPayloadMinimal(),
    applyLegacyFiscalTransform: async (p) => { legacyCalled = true; return p; },
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(result.engine, AUTHORITY_ENGINE.LEGACY);
  assert.equal(legacyCalled, true);
  assert.equal(result.legacyFiscalApplied, true);
});

test('8F1-HARD-02: rollout LEGACY → legacy permitido', async () => {
  insertRule('hard-02');
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, { mode: ROLLOUT_MODE.LEGACY, enabled: true });
    const decision = await evaluateAuthorityDecision({
      empresaId: TENANT,
      documentType: 'NFE',
      meiNotaRecordId: 'hard-02-emit',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.TENANT_MODE_LEGACY));
  });
});

test('8F1-HARD-03: AUTHORITATIVE + sem accountant rule → bloqueia', async () => {
  resetFiscalConfigurationRepository();
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const decision = await evaluateAuthorityDecision({
      empresaId: TENANT,
      documentType: 'NFE',
      meiNotaRecordId: 'hard-03-emit',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.NOT_READY_NO_ACCOUNTANT_CONFIG));
    assert.notEqual(decision.engine, AUTHORITY_ENGINE.LEGACY);
  });
});

test('8F1-HARD-04: AUTHORITATIVE + rule NOT_EXECUTABLE → bloqueia', async () => {
  insertRule('hard-04-gate', approvedBase(), {});
  insertApprovedRuleForFixture({
    id: 'hard-04-match',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 300,
    conditions: { ...STD_CONDITIONS },
    approvedResult: approvedBase({
      pis: { cst: '01', pPIS: '1.65' },
      cofins: ntCofins(),
    }),
    validFrom: '2020-01-01',
    approvedBy: 'acc-8f1',
  });
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const routing = await evaluateAuthoritativeEmissionRouting({
      empresaId: TENANT,
      documentType: 'NFE',
      legacyPayload: commercialPayloadMinimal(),
      meiNotaRecordId: 'hard-04-emit',
    });
    assert.equal(routing.route, AUTHORITY_ENGINE.BLOCKED);
    assert.equal(routing.authoritativeFiscalBlocked, true);
    assert.notEqual(routing.route, AUTHORITY_ENGINE.LEGACY);
  });
});

test('8F1-HARD-05: AUTHORITATIVE + bridge incapaz → bloqueia', async () => {
  insertRule('hard-05');
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  delete fiscalResult.resolutions.xmlFields.taxes.icms.fields.orig;
  const bridge = applyAuthoritativePlugnotasTributosBridge({
    payload: { itens: [{}] },
    itemGroups: [{ fiscalResults: [fiscalResult] }],
  });
  assert.equal(bridge.ok, false);
  assert.ok(bridge.issues.some((i) => i.code === 'AUTHORITATIVE_PROVIDER_BRIDGE_NOT_EXECUTABLE'));
});

test('8F1-HARD-06: sem recalculate legacy após falha authoritative', async () => {
  resetFiscalConfigurationRepository();
  let legacyCalled = false;
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const result = await resolveNfeEmitPayloadForPlugnotas({
      empresaId: TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayloadMinimal(),
      applyLegacyFiscalTransform: async (p) => { legacyCalled = true; return p; },
      applyTechnicalTransforms: async (p) => p,
    });
    assert.equal(result.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.equal(legacyCalled, false);
    assert.equal(result.legacyFiscalApplied, false);
    assert.equal(result.blocked, true);
  });
});

test('8F1-HARD-07: accountant rules não exigem productionReady=true', async () => {
  insertRule('hard-07');
  assert.equal(hasAuthoritativeAccountantConfigReadiness(TENANT), true);
  const rules = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js')
    .then((m) => m.listAccountantApprovedRulesForTenantSync(TENANT));
  assert.ok(rules.every((r) => r.productionReady !== true));
});

test('8F1-HARD-08: gate accountant permite resolver quando config adequada', async () => {
  insertRule('hard-08');
  const lot = seedLotForRouting();
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    assert.equal(hasAuthoritativeAccountantConfigReadiness(TENANT), true);
    const decision = await evaluateAuthorityDecision({
      empresaId: TENANT,
      documentType: 'NFE',
      meiNotaRecordId: 'hard-08-emit',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.V3);
    const routing = await evaluateAuthoritativeEmissionRouting({
      ...authoritativeRoutingParams(lot),
      meiNotaRecordId: 'hard-08-emit',
    });
    assert.equal(routing.route, AUTHORITY_ENGINE.V3);
    assert.equal(routing.preflight?.ok, true);
  });
});

test('8F1-HARD-09: gate não usa allowNonProductionRules bypass', () => {
  const prodOpts = normalizeResolverOptions({});
  assert.equal(prodOpts.allowNonProductionRules, false);
  assert.equal(DEFAULT_RESOLVER_OPTIONS.allowNonProductionRules, false);
});

test('8F1-HARD-10: PIS NT bridge — shape mínimo (somente CST)', async () => {
  insertRule('hard-10', { pis: ntPis('07') });
  const { fiscalResult } = await resolveAndBridge();
  const plugPis = mapFiscalV3PisCofinsToPlugnotasTributos(
    fiscalResult.resolutions.xmlFields.taxes.pis,
    'pis',
  );
  assert.deepEqual(plugPis, { cst: '07' });
  const normalized = normalizePlugnotasNfePayload({
    itens: [{ tributos: { pis: plugPis, icms: { csosn: '102' }, cofins: { cst: '08' } } }],
  });
  assert.equal(normalized.itens[0].tributos.pis.baseCalculo.valor, 0);
  assert.equal(normalized.itens[0].tributos.pis.aliquota, 0);
});

test('8F1-HARD-11: COFINS NT bridge — shape mínimo (somente CST)', async () => {
  insertRule('hard-11', { cofins: ntCofins('08') });
  const { fiscalResult } = await resolveAndBridge();
  const plugCofins = mapFiscalV3PisCofinsToPlugnotasTributos(
    fiscalResult.resolutions.xmlFields.taxes.cofins,
    'cofins',
  );
  assert.deepEqual(plugCofins, { cst: '08' });
});

test('8F1-HARD-12: OUTR_ZERO continua exigindo zero explícito', async () => {
  insertRule('hard-12', { pis: outrZeroPis('49', '0'), cofins: outrZeroCofins('49', '0') });
  const { bridged } = await resolveAndBridge();
  assert.strictEqual(bridged.payload.itens[0].tributos.pis.valor, 0);
  assert.strictEqual(bridged.payload.itens[0].tributos.cofins.valor, 0);
  assert.throws(
    () => mapFiscalV3PisCofinsToPlugnotasTributos({
      group: 'PISOutr',
      fields: { CST: '49', vBC: '10.00' },
    }, 'pis'),
    /pPIS ausente/,
  );
});

test('8F1-HARD-13: routing real authoritative — gates + preflight V3', async () => {
  insertRule('hard-13');
  const lot = seedLotForRouting();
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const routing = await evaluateAuthoritativeEmissionRouting({
      ...authoritativeRoutingParams(lot),
      meiNotaRecordId: 'hard-13-emit',
    });
    assert.equal(routing.route, AUTHORITY_ENGINE.V3);
    assert.equal(routing.preflight?.ok, true);
    assert.equal(routing.authorityDecision?.engine, AUTHORITY_ENGINE.V3);
    assert.ok(routing.authorityDecision?.reasons.includes(AUTHORITY_DECISION_REASON.V3_CANDIDATE));
  });
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('8F1-HARD-14: falha authoritative — sem fallback fiscal silencioso', async () => {
  resetFiscalConfigurationRepository();
  let legacyCalled = false;
  let providerCalled = false;
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const result = await resolveNfeEmitPayloadForPlugnotas({
      empresaId: TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayloadMinimal(),
      applyLegacyFiscalTransform: async (p) => { legacyCalled = true; return p; },
      applyTechnicalTransforms: async (p) => { providerCalled = true; return p; },
    });
    assert.equal(result.blocked, true);
    assert.equal(result.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.notEqual(result.legacyFiscalApplied, true);
    assert.equal(legacyCalled, false);
    assert.equal(providerCalled, false);
  });
});

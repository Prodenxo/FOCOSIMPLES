/**
 * Fase 8F.4 — establishment boundary / workspace multi-CNPJ.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  normalizeEstablishmentIdFromEmitenteCpfCnpj,
  resolveEstablishmentIdFromPayload,
  requireAuthoritativeEstablishmentId,
  assertEstablishmentBoundaryInvariant,
  extractMatchingFactsFromContext,
  buildFiscalContextFromAllocation,
  buildFiscalContextV31,
  saveCompanyFiscalProfile,
  getCompanyFiscalProfile,
  insertApprovedRuleForFixture,
  listAccountantApprovedRulesForTenant,
  hasAuthoritativeAccountantConfigReadiness,
  hasAuthoritativeAccountantConfigReadinessAsync,
  evaluateAuthorityDecision,
  evaluateAuthorityDecisionForDryRunReadOnly,
  runAuthoritativeNfeDryRunReadOnly,
  importPurchaseNfeXml,
  validatePurchaseRecipientForEstablishment,
  allocateFiscalStockForSaleItem,
  planFifoAllocation,
  evaluateLotEligibility,
  upsertInMemoryRolloutPolicy,
  getRolloutPolicyForEmpresa,
  persistAuthorityRoutingAttempt,
  findEmissionAttemptById,
  AUTHORITY_ENGINE,
  ROLLOUT_MODE,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
  isFiscalEngineV3Enabled,
  __withFiscalEngineFlagsForTests,
  __resetRolloutPolicyMemoryForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
  __resetRolloutPolicyServiceForTests,
  __resetEmissionAttemptServiceForTests,
  __resetPurchaseRepoForTests,
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
  resetFiscalConfigurationRepository,
} from '../../src/fiscal-engine/index.js';
import {
  bootstrapPhase8cFixtures,
  PHASE8C_TENANT_ID,
  PHASE8C_PRODUCT_ID,
  PHASE8C_TEST_EMITENTE_CNPJ,
  mirrorDefaultConfigToEstablishment,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';
import { getInMemoryRolloutPolicy } from '../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js';
import {
  __bindStockAllocationLotsMap,
  __resetStockAllocationMemoryRepo,
} from '../../src/fiscal-engine/allocation/stock-allocation-memory.repository.js';
import {
  __resetFiscalPurchaseMemoryRepo,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase-memory.repository.js';
import { memoryRepository as purchaseMemoryRepo, __setPurchaseRepoForTests } from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import * as memoryAllocationRepo from '../../src/fiscal-engine/allocation/stock-allocation-memory.repository.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import { buildMinimalPurchaseNfeXml } from './fixtures/purchase-xml-builder.js';
import { approvedRuleMatchesFacts } from '../../src/fiscal-engine/fiscal-configuration/approved-rule-matcher.js';
import {
  saveCompanyFiscalProfile as saveCompanyFiscalProfileMemory,
  getCompanyFiscalProfile as getCompanyFiscalProfileMemory,
} from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-memory.repository.js';

const TENANT = PHASE8C_TENANT_ID;
const CNPJ_0145 = '35774511000145';
const CNPJ_0167 = '43627677000167';
const PRODUCT = PHASE8C_PRODUCT_ID;

const STD_RULE = {
  crt: [1],
  operationType: ['VENDA'],
  operationScope: ['INTERNAL'],
  itemSource: ['THIRD_PARTY'],
  recipientTaxpayerStatus: ['NON_TAXPAYER'],
  priorStStatus: ['NO_ST_EVIDENCE'],
  issuerUf: ['RJ'],
  destinationUf: ['RJ'],
};

const setupTenant = () => {
  __resetRolloutPolicyMemoryForTests();
  __resetFiscalConfigurationRepositoryServiceForTests();
  __resetRolloutPolicyServiceForTests();
  __resetEmissionAttemptServiceForTests();
  __resetFiscalPurchaseMemoryRepo();
  __resetStockAllocationMemoryRepo();
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
};

const saveProfile = (establishmentId, overrides = {}) => {
  saveCompanyFiscalProfileMemory({
    id: `cfp-${establishmentId}`,
    tenantId: TENANT,
    companyId: TENANT,
    establishmentId,
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    municipalityCode: '3304557',
    stateRegistration: '12345678',
    stateRegistrationStatus: 'ACTIVE',
    mainCnae: '4712100',
    isIcmsTaxpayer: true,
    validFrom: '2020-01-01',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    configuredBy: 'acc',
    configuredAt: '2026-01-01T00:00:00.000Z',
    approvedBy: 'acc',
    approvedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
};

const saveRule = (id, establishmentId, overrides = {}) => {
  insertApprovedRuleForFixture({
    id,
    tenantId: TENANT,
    establishmentId,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: { ...STD_RULE, ...overrides.conditions },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
      pis: { cst: '07' },
      cofins: { cst: '08' },
      ...(overrides.approvedResult ?? {}),
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
    ...overrides,
  });
};

const commercialPayload = (cnpj = CNPJ_0145) => ({
  config: { producao: false },
  emitente: { cpfCnpj: cnpj, crt: 1, endereco: { estado: 'RJ' } },
  destinatario: { cpfCnpj: '12345678901', endereco: { estado: 'RJ' } },
  itens: [{
    produtoCatalogoId: PRODUCT,
    quantidade: '1.0000',
    valorUnitario: '10.00',
    ncm: '22021000',
    descricao: 'Item teste',
  }],
});

test('8F4-EST-01 CNPJ emitente normaliza para establishmentId', () => {
  assert.equal(normalizeEstablishmentIdFromEmitenteCpfCnpj('35.774.511/0001-45'), CNPJ_0145);
  assert.equal(normalizeEstablishmentIdFromEmitenteCpfCnpj('12345678901'), null);
});

test('8F4-EST-02 FiscalContext recebe establishmentId', () => {
  const ctx = buildFiscalContextV31({
    emitente: { cpfCnpj: CNPJ_0145, crt: 1, uf: 'RJ' },
    destinatario: { cpfCnpj: '12345678901', uf: 'RJ' },
    produto: { ncm: '22021000' },
    item: { itemSource: 'THIRD_PARTY', quantidade: 1, valorUnitario: 1 },
    estoque: { origemMercadoria: '0', priorStStatus: 'NO_ST_EVIDENCE' },
  });
  assert.equal(ctx.emitente.establishmentId, CNPJ_0145);
});

test('8F4-EST-03 matchingFacts recebe establishmentId', () => {
  const facts = extractMatchingFactsFromContext({
    empresaId: TENANT,
    emitente: { establishmentId: CNPJ_0145, crt: 1, uf: 'RJ' },
    operacao: { localizacao: 'INTERNA' },
    destinatario: { cpfCnpj: '12345678901' },
    produto: { ncm: '22021000' },
    item: { itemSource: 'THIRD_PARTY' },
    estoque: { priorStStatus: 'NO_ST_EVIDENCE' },
    dataOperacao: '2026-01-01',
  });
  assert.equal(facts.establishmentId, CNPJ_0145);
});

test('8F4-EST-04 CompanyFiscalProfile exato 0145 é carregado', () => {
  setupTenant();
  saveProfile(CNPJ_0145);
  const profile = getCompanyFiscalProfileMemory(TENANT, CNPJ_0145);
  assert.equal(profile.establishmentId, CNPJ_0145);
  assert.equal(profile.status, FISCAL_PROFILE_STATUS.ACTIVE);
});

test('8F4-EST-05 profile 0167 não serve para 0145', () => {
  setupTenant();
  saveProfile(CNPJ_0167, { issuerUf: 'SP' });
  const profile = getCompanyFiscalProfileMemory(TENANT, CNPJ_0145);
  assert.equal(profile, null);
});

test('8F4-EST-06 AccountantRule 0145 casa com 0145', () => {
  setupTenant();
  saveRule('rule-0145', CNPJ_0145);
  const rule = listAccountantApprovedRulesForTenant(TENANT).find((r) => r.id === 'rule-0145');
  const facts = { tenantId: TENANT, establishmentId: CNPJ_0145, crt: 1, operationType: 'VENDA', operationScope: 'INTERNAL', itemSource: 'THIRD_PARTY', recipientTaxpayerStatus: 'NON_TAXPAYER', priorStStatus: 'NO_ST_EVIDENCE', issuerUf: 'RJ', destinationUf: 'RJ', ncm: '22021000', referenceDate: '2026-01-01' };
  assert.equal(approvedRuleMatchesFacts(rule, facts).matches, true);
});

test('8F4-EST-07 AccountantRule 0167 não casa com 0145', () => {
  setupTenant();
  saveRule('rule-0167', CNPJ_0167);
  const rule = listAccountantApprovedRulesForTenant(TENANT).find((r) => r.id === 'rule-0167');
  const facts = { tenantId: TENANT, establishmentId: CNPJ_0145, crt: 1, operationType: 'VENDA', operationScope: 'INTERNAL', itemSource: 'THIRD_PARTY', recipientTaxpayerStatus: 'NON_TAXPAYER', priorStStatus: 'NO_ST_EVIDENCE', issuerUf: 'RJ', destinationUf: 'RJ', ncm: '22021000', referenceDate: '2026-01-01' };
  assert.equal(approvedRuleMatchesFacts(rule, facts).matches, false);
});

test('8F4-EST-08 readiness accountant é establishment-scoped', async () => {
  setupTenant();
  saveProfile(CNPJ_0145);
  saveRule('rule-ready-0145', CNPJ_0145);
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(TENANT, CNPJ_0145), true);
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(TENANT, CNPJ_0167), false);
  assert.equal(hasAuthoritativeAccountantConfigReadiness(TENANT, CNPJ_0145), true);
});

test('8F4-EST-09 dry-run reporta tenant + establishment', async () => {
  setupTenant();
  mirrorDefaultConfigToEstablishment(TENANT, CNPJ_0145);
  saveRule('rule-dry-0145', CNPJ_0145);
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    establishmentId: CNPJ_0145,
  });
  const lot = buildUsableStockLot({
    empresaId: TENANT,
    establishment_id: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '5.0000000000',
  });
  const result = await runAuthoritativeNfeDryRunReadOnly({
    empresaId: TENANT,
    commercialPayload: commercialPayload(CNPJ_0145),
    inMemoryLotsByProduct: { [PRODUCT]: [lot] },
  });
  assert.equal(result.tenantId, TENANT);
  assert.equal(result.establishmentId, CNPJ_0145);
});

test('8F4-EST-10 purchase XML destinatário 0145 aceita target 0145', async () => {
  setupTenant();
  __setPurchaseRepoForTests(purchaseMemoryRepo);
  const xml = Buffer.from(buildMinimalPurchaseNfeXml({ destCnpj: CNPJ_0145 }), 'utf8');
  const result = await importPurchaseNfeXml({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    xmlBuffer: xml,
    catalogProducts: [{ id: PRODUCT, nome: 'Prod', ncm: '22021000', unidade: 'UN' }],
    confirmedCatalogId: PRODUCT,
  });
  assert.equal(result.blocked, false);
  assert.equal(result.invoice.establishment_id, CNPJ_0145);
  __resetPurchaseRepoForTests();
});

test('8F4-EST-11 purchase XML 0167 rejeitado para target 0145', async () => {
  setupTenant();
  __setPurchaseRepoForTests(purchaseMemoryRepo);
  const xml = Buffer.from(buildMinimalPurchaseNfeXml({ destCnpj: CNPJ_0167 }), 'utf8');
  const result = await importPurchaseNfeXml({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    xmlBuffer: xml,
    catalogProducts: [{ id: PRODUCT, nome: 'Prod', ncm: '22021000', unidade: 'UN' }],
    confirmedCatalogId: PRODUCT,
  });
  assert.equal(result.blocked, true);
  assert.ok(result.issues.some((i) => i.code === 'PURCHASE_RECIPIENT_MISMATCH'));
  __resetPurchaseRepoForTests();
});

test('8F4-EST-12 não depende de empresas.cnpj para validar 0145', () => {
  const ok = validatePurchaseRecipientForEstablishment({
    destinatarioDoc: CNPJ_0145,
    targetEstablishmentId: CNPJ_0145,
  });
  const bad = validatePurchaseRecipientForEstablishment({
    destinatarioDoc: CNPJ_0167,
    targetEstablishmentId: CNPJ_0145,
  });
  assert.equal(ok.ok, true);
  assert.equal(bad.ok, false);
});

test('8F4-EST-13 lote 0145 persistido com establishment correto', async () => {
  setupTenant();
  __setPurchaseRepoForTests(purchaseMemoryRepo);
  const xml = Buffer.from(buildMinimalPurchaseNfeXml({ destCnpj: CNPJ_0145 }), 'utf8');
  const result = await importPurchaseNfeXml({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    xmlBuffer: xml,
    catalogProducts: [{ id: PRODUCT, nome: 'Prod', ncm: '22021000', unidade: 'UN' }],
    confirmedCatalogId: PRODUCT,
  });
  assert.equal(result.lots[0].establishment_id, CNPJ_0145);
  __resetPurchaseRepoForTests();
});

test('8F4-EST-14 lote 0167 invisível para venda 0145', () => {
  const lot0145 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT });
  const lot0167 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0167, produtoCatalogoId: PRODUCT });
  const elig0145 = evaluateLotEligibility(lot0145, { empresaId: TENANT, establishmentId: CNPJ_0145, produtoCatalogoId: PRODUCT });
  const elig0167 = evaluateLotEligibility(lot0167, { empresaId: TENANT, establishmentId: CNPJ_0145, produtoCatalogoId: PRODUCT });
  assert.equal(elig0145.eligible, true);
  assert.equal(elig0167.eligible, false);
  assert.equal(elig0167.reason, 'WRONG_ESTABLISHMENT');
});

test('8F4-EST-15 FIFO funciona dentro de 0145', () => {
  const lotA = buildUsableStockLot({ id: 'lot-a', empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT, dataEntrada: '2026-01-01', quantidade: '2.0000000000' });
  const lotB = buildUsableStockLot({ id: 'lot-b', empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT, dataEntrada: '2026-01-02', quantidade: '3.0000000000' });
  const lotC = buildUsableStockLot({ id: 'lot-c', empresaId: TENANT, establishment_id: CNPJ_0167, produtoCatalogoId: PRODUCT, dataEntrada: '2026-01-01', quantidade: '9.0000000000' });
  const plan = planFifoAllocation([lotC, lotB, lotA], '4.0000000000', { empresaId: TENANT, establishmentId: CNPJ_0145, produtoCatalogoId: PRODUCT });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.allocations.map((a) => a.lot.id), ['lot-a', 'lot-b']);
});

test('8F4-EST-16 mesmo produto pode possuir lotes separados 0145 e 0167', () => {
  const lot0145 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT });
  const lot0167 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0167, produtoCatalogoId: PRODUCT });
  assert.notEqual(lot0145.establishment_id, lot0167.establishment_id);
  assert.equal(lot0145.produto_catalogo_id, lot0167.produto_catalogo_id);
});

test('8F4-EST-17 allocation grava establishmentId', async () => {
  setupTenant();
  const lotsMap = new Map();
  const lot = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT });
  lotsMap.set(lot.id, lot);
  __bindStockAllocationLotsMap(lotsMap);
  __setStockAllocationRepoForTests(memoryAllocationRepo);
  const result = await allocateFiscalStockForSaleItem({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '1.0000',
    allocationRequestId: `req-${randomUUID()}`,
  });
  assert.equal(result.ok, true);
  assert.equal(result.allocations[0].establishment_id, CNPJ_0145);
  __resetStockAllocationRepoForTests();
});

test('8F4-EST-18 rollout 0145 não ativa 0167', async () => {
  setupTenant();
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    establishmentId: CNPJ_0145,
  });
  const policy0145 = await getRolloutPolicyForEmpresa(TENANT, CNPJ_0145);
  const policy0167 = await getRolloutPolicyForEmpresa(TENANT, CNPJ_0167);
  assert.equal(policy0145.configured, true);
  assert.equal(policy0145.mode, ROLLOUT_MODE.AUTHORITATIVE);
  assert.equal(policy0167.configured, false);
});

test('8F4-EST-19 ausência rollout exato → LEGACY', async () => {
  setupTenant();
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    establishmentId: CNPJ_0145,
  });
  const decision = await evaluateAuthorityDecisionForDryRunReadOnly({
    empresaId: TENANT,
    documentType: 'NFE',
    commercialPayload: commercialPayload(CNPJ_0167),
  });
  assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
});

test('8F4-EST-20 master OFF continua LEGACY', async () => {
  setupTenant();
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    establishmentId: CNPJ_0145,
  });
  await __withFiscalEngineFlagsForTests({ FISCAL_ENGINE_V3: 'false' }, async () => {
    const decision = await evaluateAuthorityDecision({
      empresaId: TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayload(CNPJ_0145),
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
    assert.equal(isFiscalEngineV3Enabled(), false);
  });
});

test('8F4-EST-21 attempt persiste establishmentId', async () => {
  setupTenant();
  const { attemptId } = await persistAuthorityRoutingAttempt({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    documentType: 'NFE',
    authorityDecision: { engine: AUTHORITY_ENGINE.V3, establishmentId: CNPJ_0145 },
    attemptStatus: 'ROUTING_LEGACY',
  });
  const attempt = await findEmissionAttemptById(attemptId);
  assert.equal(attempt.establishmentId, CNPJ_0145);
});

test('8F4-EST-22 provider invariant detecta CNPJ divergente', () => {
  const inv = assertEstablishmentBoundaryInvariant({
    payloadEmitenteCpfCnpj: CNPJ_0145,
    fiscalContextEstablishmentId: CNPJ_0167,
  });
  assert.equal(inv.ok, false);
  assert.equal(inv.issue.code, 'FISCAL_ESTABLISHMENT_BOUNDARY_MISMATCH');
});

test('8F4-EST-23 certificado não define establishmentId', () => {
  assert.equal(normalizeEstablishmentIdFromEmitenteCpfCnpj('cert-id-uuid'), null);
  assert.equal(requireAuthoritativeEstablishmentId('not-a-valid-cnpj').ok, false);
});

test('8F4-EST-24 empresas.cnpj não sobrescreve emitente do payload', () => {
  const payload = commercialPayload(CNPJ_0145);
  assert.equal(resolveEstablishmentIdFromPayload(payload), CNPJ_0145);
  assert.notEqual(resolveEstablishmentIdFromPayload(payload), CNPJ_0167);
});

test('8F4-EST-25 workspace continua empresaId original', async () => {
  setupTenant();
  const ctx = buildFiscalContextFromAllocation({
    empresaId: TENANT,
    fiscalItemAllocation: {
      id: randomUUID(),
      empresa_id: TENANT,
      produto_catalogo_id: PRODUCT,
      quantidade: '1.0000',
      origem_mercadoria: '0',
      prior_st_status: 'NO_ST_EVIDENCE',
    },
    emitente: { cpfCnpj: CNPJ_0145, crt: 1, uf: 'RJ' },
    destinatario: { cpfCnpj: '12345678901', uf: 'RJ' },
    produto: { ncm: '22021000' },
    item: { itemSource: 'THIRD_PARTY' },
  });
  assert.equal(ctx.empresaId, TENANT);
  assert.equal(ctx.emitente.establishmentId, CNPJ_0145);
});

test('8F4-EST-26 dry-run zero side effects permanece', async () => {
  setupTenant();
  mirrorDefaultConfigToEstablishment(TENANT, CNPJ_0145);
  saveRule('rule-zse-0145', CNPJ_0145);
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    establishmentId: CNPJ_0145,
  });
  const lot = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT });
  const result = await runAuthoritativeNfeDryRunReadOnly({
    empresaId: TENANT,
    commercialPayload: commercialPayload(CNPJ_0145),
    inMemoryLotsByProduct: { [PRODUCT]: [lot] },
  });
  assert.deepEqual(result.sideEffects, {
    emissionAttemptsCreated: 0,
    reservationsCreated: 0,
    stockQuantityChanged: false,
    meiNotaCreated: false,
    numberingChanged: false,
    rolloutChanged: false,
    providerCalls: 0,
  });
});

test('8F4-EST-27 legacy continua funcionando com V3 OFF', async () => {
  setupTenant();
  await __withFiscalEngineFlagsForTests({ FISCAL_ENGINE_V3: 'false', FISCAL_ENGINE_V3_SHADOW: 'false' }, async () => {
    const decision = await evaluateAuthorityDecision({
      empresaId: TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayload(CNPJ_0145),
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
  });
});

test('8F4-EST-28 isolamento cross-CNPJ end-to-end', async () => {
  setupTenant();
  saveProfile(CNPJ_0145);
  saveProfile(CNPJ_0167, { issuerUf: 'SP' });
  saveRule('rule-e2e-0145', CNPJ_0145);
  saveRule('rule-e2e-0167', CNPJ_0167, { conditions: { ...STD_RULE, issuerUf: ['SP'], destinationUf: ['SP'] } });
  upsertInMemoryRolloutPolicy(TENANT, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, establishmentId: CNPJ_0145 });
  upsertInMemoryRolloutPolicy(TENANT, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, establishmentId: CNPJ_0167 });

  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(TENANT, CNPJ_0145), true);
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(TENANT, CNPJ_0167), true);

  const lot0145 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0145, produtoCatalogoId: PRODUCT });
  const lot0167 = buildUsableStockLot({ empresaId: TENANT, establishment_id: CNPJ_0167, produtoCatalogoId: PRODUCT });
  const plan = planFifoAllocation([lot0167, lot0145], '1.0000', { empresaId: TENANT, establishmentId: CNPJ_0145, produtoCatalogoId: PRODUCT });
  assert.equal(plan.allocations[0].lot.establishment_id, CNPJ_0145);

  const decision0145 = await evaluateAuthorityDecisionForDryRunReadOnly({
    empresaId: TENANT,
    commercialPayload: commercialPayload(CNPJ_0145),
  });
  const decision0167 = await evaluateAuthorityDecisionForDryRunReadOnly({
    empresaId: TENANT,
    commercialPayload: commercialPayload(CNPJ_0167),
  });
  assert.equal(getInMemoryRolloutPolicy(TENANT, CNPJ_0145).configured, true);
  assert.equal(getInMemoryRolloutPolicy(TENANT, CNPJ_0167).configured, true);
  assert.notEqual(decision0145.establishmentId, decision0167.establishmentId);
});

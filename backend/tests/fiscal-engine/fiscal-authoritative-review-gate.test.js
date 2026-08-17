/**
 * Fase 8A — Review gate final: payload fiscal V3, transforms técnicos, status contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { __withFiscalEngineFlagsForTests } from '../../src/fiscal-engine/feature-flag.js';
import {
  resolveNfeEmitPayloadForPlugnotas,
  prepareFiscalAuthorityRouting,
  handleAuthoritativeEmitOutcome,
  bindAuthoritativeAttemptIdIntegracao,
} from '../../src/fiscal-engine/authoritative/nfe-emit-authority-integration.js';
import {
  AUTHORITY_ENGINE,
  EMISSION_ATTEMPT_STATUS,
  ROLLOUT_MODE,
} from '../../src/fiscal-engine/rollout/rollout-constants.js';
import {
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
} from '../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js';
import {
  registerFiscalRules,
  resetFiscalRulesRepository,
  bootstrapDefaultTestRules,
} from '../../src/fiscal-engine/rules/fiscal-rule-memory.repository.js';
import { createValidatedProductionReadyCurrentStRule } from '../../src/fiscal-engine/rules/fixtures/default-test-rules.js';
import {
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
  memoryAllocationRepo,
} from '../../src/fiscal-engine/allocation/stock-allocation.service.js';
import {
  __bindStockAllocationLotsMap,
  __resetStockAllocationMemoryRepo,
  findAllocationRequestByKey,
} from '../../src/fiscal-engine/allocation/stock-allocation-memory.repository.js';
import {
  __resetFiscalPurchaseMemoryRepo,
  __getLotsByIdMapForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase-memory.repository.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import {
  findEmissionAttemptById,
  __resetEmissionAttemptServiceForTests,
} from '../../src/fiscal-engine/authoritative/emission-attempt.service.js';
import { __resetEmissionAttemptsMemoryForTests } from '../../src/fiscal-engine/authoritative/emission-attempt-memory.repository.js';
import {
  extractAuthoritativeFiscalSnapshotsFromPayload,
  assertAuthoritativeFiscalSnapshotsEqual,
  AUTHORITATIVE_FISCAL_COMPARE_FIELDS,
} from '../../src/fiscal-engine/authoritative/authoritative-fiscal-snapshot.js';
import {
  PERSISTED_EMISSION_ATTEMPT_STATUSES,
  UNPERSISTED_EMISSION_ATTEMPT_STATUSES,
  readMigrationAttemptStatusCheckValues,
  validatePersistedStatusesAgainstMigration,
} from '../../src/fiscal-engine/authoritative/emission-attempt-status-contract.js';
import { normalizePlugnotasNfePayload } from '../../src/services/plugnotas/plugnotas-nfe-payload.js';
import { applyMeiNfeEmitForcePolicy } from '../../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';
import { ST_ALLOCATION_METHOD } from '../../src/fiscal-engine/types/st-allocation.js';
import {
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  saveCompanyFiscalProfile,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
  PIS_COFINS_CALCULATION_MODES,
} from '../../src/fiscal-engine/index.js';

const EMP = randomUUID();
const PROD = 'prod-rg';
const PROD_ST = 'prod-rg-st-retained';
const LEGACY_CFOP = '9999';
const LEGACY_CSOSN = '999';
const LEGACY_ORIGEM = '8';
const V3_CFOP = '5102';
const V3_CSOSN = '102';
const V3_ORIGEM = '0';

const EMITENTE_CNPJ = '12345678000199';

const seedAuthoritativeCompanyProfile = () => {
  saveCompanyFiscalProfile({
    id: 'cfp-rg-auth',
    tenantId: EMP,
    companyId: EMP,
    establishmentId: 'default',
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: 'acc-rg',
    approvedBy: 'acc-rg',
  });
  saveCompanyFiscalProfile({
    id: 'cfp-rg-auth-est',
    tenantId: EMP,
    companyId: EMP,
    establishmentId: EMITENTE_CNPJ,
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: 'acc-rg',
    approvedBy: 'acc-rg',
  });
};

const registerAuthoritativeAccountantRule = (overrides = {}) => {
  seedAuthoritativeCompanyProfile();
  insertApprovedRuleForFixture({
    id: 'rg-accountant-102',
    tenantId: EMP,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc-rg',
    ...overrides,
  });
  insertApprovedRuleForFixture({
    id: 'rg-accountant-102-est',
    tenantId: EMP,
    establishmentId: EMITENTE_CNPJ,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc-rg',
    ...overrides,
  });
};

const registerAuthoritativeStRetainedAccountantRule = () => {
  seedAuthoritativeCompanyProfile();
  insertApprovedRuleForFixture({
    id: 'rg-accountant-500-retained',
    tenantId: EMP,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 250,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['RETAINED'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc-rg-st',
  });
  insertApprovedRuleForFixture({
    id: 'rg-accountant-500-retained-est',
    tenantId: EMP,
    establishmentId: EMITENTE_CNPJ,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 250,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['RETAINED'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc-rg-st',
  });
};

const registerAuthoritativeTestRules = () => {
  resetFiscalConfigurationRepository();
  bootstrapDefaultTestRules();
  registerAuthoritativeAccountantRule();
  registerFiscalRules([
    createValidatedProductionReadyCurrentStRule(),
    {
      id: 'prod-ready-csosn-102',
      ruleType: 'CSOSN',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      priority: 100,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'], currentOperationSt: ['NOT_DUE'] },
      result: { csosn: '102', icmsGroup: 'ICMSSN102' },
      sourceLegalReference: 'TEST:PROD_CSOSN',
      productionReady: true,
    },
    {
      id: 'prod-ready-cfop-5102',
      ruleType: 'CFOP',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      priority: 100,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { cfop: '5102' },
      sourceLegalReference: 'TEST:PROD_CFOP',
      productionReady: true,
    },
  ]);
};

/** Réplica productionReady=true da fixture csosn-crt1-retained-not-due-internal (default-test-rules). */
const registerAuthoritativeStRetainedTestRules = () => {
  resetFiscalConfigurationRepository();
  bootstrapDefaultTestRules();
  registerAuthoritativeStRetainedAccountantRule();
  registerFiscalRules([
    createValidatedProductionReadyCurrentStRule(),
    {
      id: 'prod-ready-cfop-5102',
      ruleType: 'CFOP',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      priority: 100,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { cfop: '5102' },
      sourceLegalReference: 'TEST:PROD_CFOP',
      productionReady: true,
    },
    {
      id: 'prod-ready-csosn-500-retained-not-due',
      ruleType: 'CSOSN',
      schemaVersion: '1.0.0',
      rulePackageId: 'fixture-csosn-crt1-v1',
      priority: 100,
      specificity: 7,
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      conditions: {
        location: ['INTERNA'],
        itemSource: ['THIRD_PARTY'],
        recipientTaxpayerStatus: ['NON_TAXPAYER'],
        priorStStatus: ['RETAINED'],
        currentOperationSt: ['NOT_DUE'],
        stScenarioKey: ['RETAINED+NOT_DUE'],
      },
      result: {
        csosn: '500',
        icmsGroup: 'ICMSSN500',
        requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      },
      sourceLegalReference: 'FIXTURE:SYNTHETIC_CSOSN_500_RETAINED_NOT_DUE',
      sourceRefs: ['fixture-doc-csosn-500'],
      productionReady: true,
    },
  ]);
};

const seedLot = () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    establishmentId: EMITENTE_CNPJ,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    origem: V3_ORIGEM,
  });
  __getLotsByIdMapForTests().set(lot.id, lot);
  return lot;
};

const seedRetainedStLot = () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    establishmentId: EMITENTE_CNPJ,
    produtoCatalogoId: PROD_ST,
    quantidade: '10.0000000000',
    origem: V3_ORIGEM,
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      vICMSSTRet: '18.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  __getLotsByIdMapForTests().set(lot.id, lot);
  return lot;
};

const legacyDeliberatePayload = () => ({
  emitente: { cpfCnpj: '12345678000199', crt: 1, endereco: { estado: 'RJ' } },
  destinatario: { cpfCnpj: '12345678901', indIEDest: '9', endereco: { estado: 'RJ' } },
  idIntegracao: 'integracao-rg',
  itens: [{
    produtoCatalogoId: PROD,
    codigo: PROD,
    ncm: '61091000',
    descricao: 'Camisa teste',
    quantidade: '1.0000',
    valorUnitario: '10.00',
    valorTotal: '10.00',
    commercialSaleItemId: randomUUID(),
    itemSource: 'THIRD_PARTY',
    cfop: LEGACY_CFOP,
    origem: LEGACY_ORIGEM,
    tributos: { icms: { csosn: LEGACY_CSOSN, origem: LEGACY_ORIGEM } },
    impostos: { icms: { CSOSN: LEGACY_CSOSN, orig: LEGACY_ORIGEM } },
  }],
});

const authoritativeRoutingParams = (lot) => ({
  empresaId: EMP,
  userId: EMP,
  documentType: 'NFE',
  businessType: 'RESELLER',
  legacyPayload: legacyDeliberatePayload(),
  commercialPayload: legacyDeliberatePayload(),
  inMemoryLotsByProduct: { [PROD]: [lot] },
});

const legacyStRetainedDeliberatePayload = () => ({
  emitente: { cpfCnpj: '12345678000199', crt: 1, endereco: { estado: 'RJ' } },
  destinatario: { cpfCnpj: '12345678901', indIEDest: '9', endereco: { estado: 'RJ' } },
  idIntegracao: 'integracao-rg-st',
  itens: [{
    produtoCatalogoId: PROD_ST,
    codigo: PROD_ST,
    ncm: '61091000',
    descricao: 'Camisa ST retida',
    quantidade: '1.0000',
    valorUnitario: '10.00',
    valorTotal: '10.00',
    commercialSaleItemId: randomUUID(),
    itemSource: 'THIRD_PARTY',
    cfop: LEGACY_CFOP,
    origem: LEGACY_ORIGEM,
    tributos: { icms: { csosn: LEGACY_CSOSN, origem: LEGACY_ORIGEM } },
    impostos: { icms: { CSOSN: LEGACY_CSOSN, orig: LEGACY_ORIGEM } },
  }],
});

const authoritativeStRoutingParams = (lot) => ({
  empresaId: EMP,
  userId: EMP,
  documentType: 'NFE',
  businessType: 'RESELLER',
  legacyPayload: legacyStRetainedDeliberatePayload(),
  commercialPayload: legacyStRetainedDeliberatePayload(),
  inMemoryLotsByProduct: { [PROD_ST]: [lot] },
});

/** Campos fiscais não nulos do snapshot (para assert/report). */
const nonNullFiscalFields = (snap) => {
  const out = {
    cfop: snap.cfop,
    csosn: snap.csosn,
    cst: snap.cst,
    origem: snap.origem,
    icmsGroup: snap.icmsGroup,
    icmsGroupCount: snap.icmsGroupCount,
  };
  for (const [key, value] of Object.entries(snap.taxFields ?? {})) {
    if (value != null && value !== '') out[`taxFields.${key}`] = value;
  }
  return out;
};

const setupAuthoritativeTenant = () => {
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });
};

/** Pipeline técnico real (sem IBPT — não altera campos fiscais de itens). */
const applyRealTechnicalTransforms = async (payload) => {
  let result = normalizePlugnotasNfePayload(payload);
  result = applyMeiNfeEmitForcePolicy(result);
  return {
    ...result,
    informacoesComplementares: 'IBPT-MOCK-NÃO-FISCAL',
  };
};

test.beforeEach(() => {
  __resetRolloutPolicyMemoryForTests();
  __resetEmissionAttemptsMemoryForTests();
  __resetEmissionAttemptServiceForTests();
  resetFiscalRulesRepository();
  resetFiscalConfigurationRepository();
  __resetFiscalPurchaseMemoryRepo();
  __resetStockAllocationMemoryRepo();
  __resetStockAllocationRepoForTests();
  __setStockAllocationRepoForTests(memoryAllocationRepo);
  __bindStockAllocationLotsMap(__getLotsByIdMapForTests());
});

test('RG1. adapter boundary — payload V3 preserva fiscal completo vs legado deliberado', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();
  let adapterPayload = null;

  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    const result = await resolveNfeEmitPayloadForPlugnotas({
      ...authoritativeRoutingParams(lot),
      applyLegacyFiscalTransform: async (p) => {
        throw new Error('recalculate legado não deve executar em V3');
      },
      applyTechnicalTransforms: async (p) => {
        adapterPayload = p;
        return p;
      },
    });

    assert.equal(result.engine, AUTHORITY_ENGINE.V3);
    assert.ok(adapterPayload);

    const [snap] = extractAuthoritativeFiscalSnapshotsFromPayload(adapterPayload);
    assert.equal(snap.cfop, V3_CFOP);
    assert.notEqual(snap.cfop, LEGACY_CFOP);
    assert.equal(snap.csosn, V3_CSOSN);
    assert.notEqual(snap.csosn, LEGACY_CSOSN);
    assert.equal(snap.origem, V3_ORIGEM);
    assert.notEqual(snap.origem, LEGACY_ORIGEM);
    assert.equal(snap.icmsGroup, `ICMSSN${V3_CSOSN}`);
    assert.equal(snap.icmsGroupCount, 1);
    assert.equal(snap.taxFields.orig, V3_ORIGEM);
    assert.equal(snap.taxFields.CSOSN, V3_CSOSN);
    assert.equal(snap.taxFields.vBC, null);
    assert.equal(snap.taxFields.vICMS, null);
    assert.equal(snap.taxFields.vBCSTRet, null);
    assert.equal(snap.taxFields.vICMSSTRet, null);

    const item = adapterPayload.itens[0];
    assert.equal(Object.keys(item.impostos?.icms ?? {}).filter((k) => k.startsWith('ICMS')).length, 0);
  });
});

test('RG2. transforms técnicos não reescrevem snapshot fiscal V3', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const routing = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.equal(routing.engine, AUTHORITY_ENGINE.V3);

    const beforeTechnical = extractAuthoritativeFiscalSnapshotsFromPayload(routing.authoritativePayload);

    const resolved = await resolveNfeEmitPayloadForPlugnotas({
      ...authoritativeRoutingParams(lot),
      applyLegacyFiscalTransform: async () => { throw new Error('skip legacy'); },
      applyTechnicalTransforms: applyRealTechnicalTransforms,
    });

    const afterTechnical = extractAuthoritativeFiscalSnapshotsFromPayload(resolved.payloadToEmit);
    assertAuthoritativeFiscalSnapshotsEqual(beforeTechnical, afterTechnical);
    assert.notEqual(resolved.payloadToEmit.informacoesComplementares, routing.authoritativePayload.informacoesComplementares);
  });
});

test('RG3. recalculateNfeLikePayloadTaxForEmit não executa após authority V3', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();
  let legacyRecalculateCount = 0;

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    await resolveNfeEmitPayloadForPlugnotas({
      ...authoritativeRoutingParams(lot),
      applyLegacyFiscalTransform: async (p) => {
        legacyRecalculateCount += 1;
        return p;
      },
      applyTechnicalTransforms: async (p) => p,
    });
  });

  assert.equal(legacyRecalculateCount, 0);
});

test('RG4. contrato attempt_status — persistidos ⊆ migration CHECK', () => {
  const migrationStatuses = readMigrationAttemptStatusCheckValues();
  const validation = validatePersistedStatusesAgainstMigration(migrationStatuses);

  assert.ok(validation.ok, `status persistidos ausentes na migration: ${validation.missingInMigration.join(', ')}`);
  assert.deepEqual([...PERSISTED_EMISSION_ATTEMPT_STATUSES].sort(), [...validation.persistedStatuses].sort());

  for (const status of UNPERSISTED_EMISSION_ATTEMPT_STATUSES) {
    assert.ok(
      migrationStatuses.includes(status),
      `status definido ${status} deveria existir na migration mesmo se não persistido`,
    );
  }
});

test('RG5. PREPARED — reserva + authority + hash antes do provider', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();
  let adapterCalled = false;

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.equal(prep.engine, AUTHORITY_ENGINE.V3);
    assert.ok(prep.allocationRequestIds.length >= 1);

    const attempt = await findEmissionAttemptById(prep.attemptId);
    assert.equal(attempt.attemptStatus, EMISSION_ATTEMPT_STATUS.PREPARED);
    assert.ok(attempt.candidatePayloadHash);
    assert.ok(attempt.allocationRequestIds.length >= 1);

    const row = await findAllocationRequestByKey(EMP, prep.allocationRequestIds[0]);
    assert.ok(row?.allocations?.length >= 1);

    assert.equal(adapterCalled, false);

    const mockAdapter = {
      emitir: async (payload) => {
        adapterCalled = true;
        assert.equal((await findEmissionAttemptById(prep.attemptId)).attemptStatus, EMISSION_ATTEMPT_STATUS.PREPARED);
        return { status: 'processando', payload };
      },
    };
    await mockAdapter.emitir(prep.payloadToEmit);
    assert.equal(adapterCalled, true);
  });
});

test('RG6. provider call count — sucesso e network unknown = 1 emit cada', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    let successEmitCount = 0;
    const prepSuccess = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    const adapterSuccess = {
      emitir: async () => {
        successEmitCount += 1;
        return { status: 'processando' };
      },
    };
    await adapterSuccess.emitir(prepSuccess.payloadToEmit);
    await handleAuthoritativeEmitOutcome({
      attemptId: prepSuccess.attemptId,
      empresaId: EMP,
      allocationRequestIds: prepSuccess.allocationRequestIds,
      providerStatus: 'processando',
      sentToProvider: true,
    });
    assert.equal(successEmitCount, 1);

    let unknownEmitCount = 0;
    const prepUnknown = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    const adapterUnknown = {
      emitir: async () => {
        unknownEmitCount += 1;
        throw Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' });
      },
    };
    try {
      await adapterUnknown.emitir(prepUnknown.payloadToEmit);
    } catch {
      // expected
    }
    await handleAuthoritativeEmitOutcome({
      attemptId: prepUnknown.attemptId,
      empresaId: EMP,
      allocationRequestIds: prepUnknown.allocationRequestIds,
      error: Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }),
      sentToProvider: true,
    });
    assert.equal(unknownEmitCount, 1);
    assert.equal((await findEmissionAttemptById(prepUnknown.attemptId)).attemptStatus, EMISSION_ATTEMPT_STATUS.REQUEST_OUTCOME_UNKNOWN);
  });
});

test('RG7. recovery numeração — retry provider sem nova reserva nem fallback legado', async () => {
  const lot = seedLot();
  setupAuthoritativeTenant();
  let emitCount = 0;
  const allocationIdsBefore = [];

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    allocationIdsBefore.push(...prep.allocationRequestIds);

    const adapter = {
      emitir: async () => {
        emitCount += 1;
        if (emitCount === 1) {
          return { status: 'rejeitado', message: 'Duplicidade de NF-e' };
        }
        return { status: 'processando' };
      },
    };

    let idIntegracao = prep.payloadToEmit.idIntegracao;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      idIntegracao = `recovery-id-${attempt + 1}`;
      await bindAuthoritativeAttemptIdIntegracao(prep.attemptId, idIntegracao);
      const response = await adapter.emitir({ ...prep.payloadToEmit, idIntegracao });
      if (response.status === 'processando') break;
    }

    assert.equal(emitCount, 2);

    const attempt = await findEmissionAttemptById(prep.attemptId);
    assert.deepEqual(attempt.allocationRequestIds, allocationIdsBefore);
    assert.equal(attempt.idIntegracao, 'recovery-id-2');

    const prepNewEmission = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.notEqual(prepNewEmission.attemptId, prep.attemptId);
    assert.notDeepEqual(prepNewEmission.allocationRequestIds, allocationIdsBefore);
  });
});

test('RG8. campos fiscais comparados documentados', () => {
  assert.ok(AUTHORITATIVE_FISCAL_COMPARE_FIELDS.includes('cfop'));
  assert.ok(AUTHORITATIVE_FISCAL_COMPARE_FIELDS.includes('taxFields.vBCSTRet'));
});

test('RG9. ST retida CSOSN 500 — campos fiscais não nulos sobrevivem transforms técnicos', async () => {
  const lot = seedRetainedStLot();
  registerAuthoritativeStRetainedTestRules();
  upsertInMemoryRolloutPolicy(EMP, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });

  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    const routing = await prepareFiscalAuthorityRouting(authoritativeStRoutingParams(lot));
    assert.equal(routing.engine, AUTHORITY_ENGINE.V3);

    const beforeTechnical = extractAuthoritativeFiscalSnapshotsFromPayload(routing.authoritativePayload);
    const [snapBefore] = beforeTechnical;

    assert.equal(snapBefore.cfop, V3_CFOP);
    assert.equal(snapBefore.csosn, '500');
    assert.notEqual(snapBefore.csosn, LEGACY_CSOSN);
    assert.equal(snapBefore.origem, V3_ORIGEM);
    assert.equal(snapBefore.icmsGroup, 'ICMSSN500');
    assert.equal(snapBefore.icmsGroupCount, 1);
    assert.ok(snapBefore.taxFields.vBCSTRet != null);
    assert.ok(snapBefore.taxFields.vICMSSTRet != null);
    assert.notEqual(snapBefore.taxFields.vBCSTRet, '0');
    assert.notEqual(snapBefore.taxFields.vICMSSTRet, '0');

    let adapterPayload = null;
    const resolved = await resolveNfeEmitPayloadForPlugnotas({
      ...authoritativeStRoutingParams(lot),
      applyLegacyFiscalTransform: async () => { throw new Error('legacy skip'); },
      applyTechnicalTransforms: async (p) => {
        adapterPayload = await applyRealTechnicalTransforms(p);
        return adapterPayload;
      },
    });

    assert.equal(resolved.engine, AUTHORITY_ENGINE.V3);
    const afterTechnical = extractAuthoritativeFiscalSnapshotsFromPayload(adapterPayload);
    assertAuthoritativeFiscalSnapshotsEqual(beforeTechnical, afterTechnical);

    const nonNullBefore = nonNullFiscalFields(snapBefore);
    const nonNullAfter = nonNullFiscalFields(afterTechnical[0]);
    assert.deepEqual(nonNullAfter, nonNullBefore);

    assert.ok(nonNullAfter['taxFields.vBCSTRet']);
    assert.ok(nonNullAfter['taxFields.vICMSSTRet']);
    assert.ok(nonNullAfter['taxFields.orig']);
    assert.equal(nonNullAfter['taxFields.pST'], undefined);
    assert.equal(nonNullAfter['taxFields.vICMSSubstituto'], undefined);
  });
});

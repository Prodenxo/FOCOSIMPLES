/**
 * Fixtures Phase 8C — tenant T1 com configuração aprovada pelo contador.
 */
import {
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
  OPERATION_SCOPE,
  PRODUCT_ITEM_SOURCE,
} from '../constants.js';
import {
  saveCompanyFiscalProfile,
  saveProductFiscalProfile,
  saveCustomerTaxProfile,
  saveAccountantApprovedRule,
  saveFiscalRuleTemplate,
  saveTaxCatalogEntry,
  resetFiscalConfigurationRepository,
  insertApprovedRuleForFixture,
  getCompanyFiscalProfile,
  listAccountantApprovedRulesForTenant,
} from '../fiscal-configuration-memory.repository.js';

export const PHASE8C_TENANT_ID = 'tenant-phase8c-t1';
export const PHASE8C_TENANT_B = 'tenant-phase8c-t2';
export const PHASE8C_PRODUCT_ID = 'prod-phase8c-001';
export const PHASE8C_TEST_EMITENTE_CNPJ = '12345678000199';
export const PHASE8C_CUSTOMER_TAXPAYER = 'cust-taxpayer-001';
export const PHASE8C_CUSTOMER_NON_TAXPAYER = 'cust-non-taxpayer-001';

const saveApprovedFixtureRule = (rule) => insertApprovedRuleForFixture(rule);

const mirrorDefaultConfigToEstablishment = (
  tenantId,
  establishmentId = PHASE8C_TEST_EMITENTE_CNPJ,
) => {
  const defaultProfile = getCompanyFiscalProfile(tenantId, 'default');
  if (defaultProfile) {
    saveCompanyFiscalProfile({
      ...defaultProfile,
      id: `${defaultProfile.id}-${establishmentId}`,
      establishmentId,
    });
  }

  const rules = listAccountantApprovedRulesForTenant(tenantId);
  for (const rule of rules) {
    if (rule.establishmentId && String(rule.establishmentId) !== 'default') {
      continue;
    }
    insertApprovedRuleForFixture({
      ...rule,
      id: `${rule.id}-est-${establishmentId}`,
      establishmentId,
    });
  }
};

export const bootstrapPhase8cFixtures = () => {
  resetFiscalConfigurationRepository();

  saveCompanyFiscalProfile({
    id: 'cfp-t1-default',
    tenantId: PHASE8C_TENANT_ID,
    companyId: PHASE8C_TENANT_ID,
    establishmentId: 'default',
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
    configuredBy: 'accountant-fixture',
    configuredAt: '2026-01-01T00:00:00.000Z',
    approvedBy: 'accountant-fixture',
    approvedAt: '2026-01-01T00:00:00.000Z',
  });

  saveProductFiscalProfile({
    id: 'pfp-t1-prod001',
    tenantId: PHASE8C_TENANT_ID,
    productId: PHASE8C_PRODUCT_ID,
    ncm: '22021000',
    cest: null,
    itemSource: PRODUCT_ITEM_SOURCE.RESALE,
    taxClassificationStatus: 'CONFIGURED',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: 'accountant-fixture',
    approvedBy: 'accountant-fixture',
  });

  saveCustomerTaxProfile({
    id: 'ctp-t1-taxpayer',
    tenantId: PHASE8C_TENANT_ID,
    customerId: PHASE8C_CUSTOMER_TAXPAYER,
    personType: 'PF',
    country: 'BR',
    uf: 'RJ',
    cpfCnpj: '12345678901',
    taxpayerStatus: 'NON_TAXPAYER',
    finalConsumerDefault: 'YES',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
  });

  saveCustomerTaxProfile({
    id: 'ctp-t1-pj-taxpayer',
    tenantId: PHASE8C_TENANT_ID,
    customerId: 'cust-pj-taxpayer',
    personType: 'PJ',
    uf: 'SP',
    cpfCnpj: '12345678000199',
    taxpayerStatus: 'TAXPAYER',
    finalConsumerDefault: 'NO',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
  });

  saveFiscalRuleTemplate({
    id: 'tpl-internal-resale-crt1',
    name: 'Venda interna revenda CRT1',
    description: 'Template — venda interna mercadoria adquirida de terceiros',
    suggestedConditions: {
      operationScope: [OPERATION_SCOPE.INTERNAL],
      itemSource: ['THIRD_PARTY'],
      crt: [1],
    },
    suggestedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
    },
    productionReady: false,
    authoritativeForTenant: false,
  });

  saveTaxCatalogEntry({
    id: 'tce-ncm-22021000-rj',
    ncm: '22021000',
    jurisdiction: 'BR-RJ',
    issuerUf: 'RJ',
    taxClassification: 'COMMON_RESALE',
    reviewStatus: 'REVIEWED',
    productionReady: false,
    effectiveFrom: '2020-01-01',
    legalSourceRefs: ['ajuste-sinief-3-2010'],
  });

  saveApprovedFixtureRule({
    id: 'aar-t1-internal-resale',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 10,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: [OPERATION_SCOPE.INTERNAL],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      icmsGroup: 'ICMSSN102',
      currentOperationSt: 'NOT_DUE',
    },
    validFrom: '2020-01-01',
    configuredBy: 'accountant-fixture',
    configuredAt: '2026-01-01T00:00:00.000Z',
    approvedBy: 'accountant-fixture',
    approvedAt: '2026-01-01T00:00:00.000Z',
    legalSourceRefs: ['ajuste-sinief-3-2010'],
    sourceLegalReference: 'Contador: venda interna revenda comum T1',
  });

  saveApprovedFixtureRule({
    id: 'aar-t1-interstate-taxpayer',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 15,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: [OPERATION_SCOPE.INTERSTATE],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'],
      issuerUf: ['RJ'],
    },
    approvedResult: {
      cfop: '6102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
    },
    validFrom: '2020-01-01',
    approvedBy: 'accountant-fixture',
    approvedAt: '2026-01-01T00:00:00.000Z',
    legalSourceRefs: ['ajuste-sinief-3-2010'],
  });

  saveApprovedFixtureRule({
    id: 'aar-t1-retained-st',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 20,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: [OPERATION_SCOPE.INTERNAL],
      itemSource: ['THIRD_PARTY'],
      priorStStatus: ['RETAINED'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      icmsGroup: 'ICMSSN500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
    },
    validFrom: '2020-01-01',
    approvedBy: 'accountant-fixture',
    approvedAt: '2026-01-01T00:00:00.000Z',
  });

  saveApprovedFixtureRule({
    id: 'aar-t1-by-product',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 5,
    conditions: {
      crt: [1],
      productId: [PHASE8C_PRODUCT_ID],
      operationType: ['VENDA'],
      operationScope: [OPERATION_SCOPE.INTERNAL],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
    },
    validFrom: '2020-01-01',
    approvedBy: 'accountant-fixture',
    approvedAt: '2026-01-01T00:00:00.000Z',
  });

  saveAccountantApprovedRule({
    id: 'aar-t1-draft-only',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.DRAFT,
    conditions: { crt: [1], operationType: ['VENDA'] },
    approvedResult: { cfop: '5101', csosn: '102' },
    validFrom: '2020-01-01',
  });

  mirrorDefaultConfigToEstablishment(PHASE8C_TENANT_ID, PHASE8C_TEST_EMITENTE_CNPJ);
};

export {
  resetFiscalConfigurationRepository,
  getCompanyFiscalProfile,
  getProductFiscalProfile,
  saveCompanyFiscalProfile,
  listAccountantApprovedRulesForTenant,
  saveAccountantApprovedRule,
} from '../fiscal-configuration-memory.repository.js';

export { mirrorDefaultConfigToEstablishment };

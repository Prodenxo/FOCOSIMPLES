/**
 * Contract tests reutilizáveis — memory e Postgres devem obedecer o mesmo contrato.
 */
import assert from 'node:assert/strict';
import {
  saveAccountantApprovedRuleDraft,
  approveAccountantRuleAtomic,
  suspendAccountantRule,
  revokeAccountantRule,
  createAccountantRuleNewVersion,
  getAccountantApprovedRule,
  listAccountantApprovedRulesForTenant,
  saveProductFiscalProfile,
  saveCustomerTaxProfile,
  saveFiscalRuleTemplate,
  saveTaxCatalogEntry,
  getProductFiscalProfile,
  getCustomerTaxProfile,
  getFiscalRuleTemplate,
  getTaxCatalogEntry,
} from '../../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import { ACCOUNTANT_RULE_STATUS } from '../../../src/fiscal-engine/fiscal-configuration/constants.js';

const validRulePayload = (tenantId, id = 'contract-rule') => ({
  id,
  tenantId,
  version: 1,
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
  approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
  validFrom: '2020-01-01',
});

export const runFiscalConfigurationRepositoryContractTests = async ({
  label,
  setup,
  teardown,
  tenantId,
  actorId,
  productId,
  customerId,
}) => {
  await setup();

  const draft = await saveAccountantApprovedRuleDraft({
    ...validRulePayload(tenantId, `contract-${label}`),
    configuredBy: actorId,
  });
  assert.equal(draft.status, ACCOUNTANT_RULE_STATUS.DRAFT);

  const approved = await approveAccountantRuleAtomic({
    tenantId,
    ruleId: draft.id,
    version: 1,
    approvedBy: actorId,
    approvedAt: new Date().toISOString(),
  });
  assert.equal(approved.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(approved.approvedBy, actorId);

  const duplicateApprove = approveAccountantRuleAtomic({
    tenantId,
    ruleId: draft.id,
    version: 1,
    approvedBy: actorId,
    approvedAt: new Date().toISOString(),
  });
  await assert.rejects(duplicateApprove, /DRAFT|Transição|status/);

  const suspended = await suspendAccountantRule({
    tenantId,
    ruleId: draft.id,
    suspendedBy: actorId,
    suspendedAt: new Date().toISOString(),
  });
  assert.equal(suspended.status, ACCOUNTANT_RULE_STATUS.SUSPENDED);

  const draft2 = await saveAccountantApprovedRuleDraft({
    ...validRulePayload(tenantId, `contract-revoke-${label}`),
    configuredBy: actorId,
  });
  await approveAccountantRuleAtomic({
    tenantId,
    ruleId: draft2.id,
    version: 1,
    approvedBy: actorId,
    approvedAt: new Date().toISOString(),
  });
  const revoked = await revokeAccountantRule({
    tenantId,
    ruleId: draft2.id,
    revokedBy: actorId,
    revokedAt: new Date().toISOString(),
  });
  assert.equal(revoked.status, ACCOUNTANT_RULE_STATUS.REVOKED);

  const product = await saveProductFiscalProfile({
    tenantId,
    productId,
    ncm: '22021000',
    status: 'ACTIVE',
    validFrom: '2020-01-01',
  });
  const fetchedProduct = await getProductFiscalProfile({ tenantId, productId });
  assert.equal(fetchedProduct.ncm, product.ncm);

  const customer = await saveCustomerTaxProfile({
    tenantId,
    customerId,
    taxpayerStatus: 'NON_TAXPAYER',
    status: 'ACTIVE',
    validFrom: '2020-01-01',
  });
  const fetchedCustomer = await getCustomerTaxProfile({ tenantId, customerId });
  assert.equal(fetchedCustomer.taxpayerStatus, customer.taxpayerStatus);

  const template = await saveFiscalRuleTemplate({
    id: `pg-test-template-${label}`,
    name: 'Template teste',
    authoritativeForTenant: false,
    productionReady: false,
  });
  assert.equal(template.authoritativeForTenant, false);
  const fetchedTemplate = await getFiscalRuleTemplate({ id: template.id });
  assert.ok(fetchedTemplate);

  const catalog = await saveTaxCatalogEntry({
    id: `pg-test-catalog-${label}`,
    ncm: '22021000',
    productionReady: false,
  });
  const fetchedCatalog = await getTaxCatalogEntry({ id: catalog.id });
  assert.ok(fetchedCatalog);

  const v2 = await createAccountantRuleNewVersion({
    ...approved,
    version: 2,
    status: ACCOUNTANT_RULE_STATUS.DRAFT,
    approvedBy: null,
    approvedAt: null,
    approvedResult: { cfop: '5101', csosn: '102', currentOperationSt: 'NOT_DUE' },
    configuredBy: actorId,
  });
  assert.equal(v2.status, ACCOUNTANT_RULE_STATUS.DRAFT);
  const v1 = await getAccountantApprovedRule({ tenantId, ruleId: draft.id, version: 1 });
  assert.equal(v1.approvedResult.cfop, '5102');

  const cross = await getAccountantApprovedRule({ tenantId: '99999999-9999-9999-9999-999999999999', ruleId: draft.id });
  assert.equal(cross, null);

  const list = await listAccountantApprovedRulesForTenant(tenantId);
  assert.ok(list.length >= 2);

  await teardown();
};

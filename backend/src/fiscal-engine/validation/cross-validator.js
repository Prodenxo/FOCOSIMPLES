/**
 * CrossValidator — verifica coerência da decisão fiscal (Fase 6).
 * Não corrige silenciosamente — apenas emite issues.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';
import { isRuleEffectiveOn } from '../rules/fiscal-rule-engine.js';

/**
 * @param {object} params
 */
export const crossValidateFiscalResolution = ({
  context,
  treatment,
  currentStResolution,
  csosnResolution,
  cfopResolution,
  xmlResolution,
  ruleRefs = [],
  appliedRules = [],
}) => {
  const issues = [];

  const location = context.operacao?.localizacao ?? treatment?.location;
  const itemSource = context.item?.itemSource ?? treatment?.itemSource;
  const origem = context.allocation?.origem ?? context.estoque?.origemMercadoria;
  const cfop = cfopResolution?.cfop
    ?? xmlResolution?.xmlFields?.product?.cfop
    ?? null;
  const csosn = csosnResolution?.csosn ?? null;
  const currentSt = currentStResolution?.currentOperationSt ?? treatment?.currentOperationSt;
  const icmsGroups = xmlResolution?.icmsGroups ?? [];
  const productCfop = xmlResolution?.xmlFields?.product?.cfop ?? null;

  if (productCfop && cfopResolution?.cfop && productCfop !== cfopResolution.cfop) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      `CFOP em product (${productCfop}) diverge do CFOP resolvido (${cfopResolution.cfop}).`,
    ));
  }

  if (currentSt === CURRENT_OPERATION_ST.DUE_BY_ISSUER && csosn === '102') {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      'currentOperationSt DUE_BY_ISSUER incompatível com CSOSN 102.',
    ));
  }

  if (treatment?.priorStStatus === 'RETAINED' && csosn === '102' && currentSt === CURRENT_OPERATION_ST.NOT_DUE) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      'priorSt RETAINED com CSOSN 102 e current ST NOT_DUE é combinação não validada.',
      { severity: 'REVIEW', blocksEmission: true, overrideAllowed: true },
    ));
  }

  const cfopConstraints = cfopResolution?.constraints ?? {};
  if (cfop && cfopConstraints.location && cfopConstraints.location !== location) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      `CFOP ${cfop} incompatível com localização ${location}.`,
    ));
  }

  if (cfop && cfopConstraints.itemSource && cfopConstraints.itemSource !== itemSource) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      `CFOP ${cfop} incompatível com itemSource ${itemSource}.`,
    ));
  }

  const recipientStatus = context.recipient?.icmsTaxpayerStatus
    ?? context.destinatario?.icmsTaxpayerStatus;
  if (cfop && cfopConstraints.recipientTaxpayerStatus
    && recipientStatus
    && cfopConstraints.recipientTaxpayerStatus !== recipientStatus) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      `CFOP ${cfop} incompatível com recipientTaxpayerStatus ${recipientStatus}.`,
    ));
  }

  const csosnConstraints = csosnResolution?.constraints ?? {};
  if (csosn && csosnConstraints.stScenarioKey
    && treatment?.stScenarioKey
    && csosnConstraints.stScenarioKey !== treatment.stScenarioKey) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      `CSOSN ${csosn} incompatível com stScenarioKey ${treatment.stScenarioKey}.`,
    ));
  }

  if (xmlResolution?.resolved && origem === 'UNKNOWN') {
    issues.push(createFiscalIssue(
      'ORIGIN_UNKNOWN',
      'Origem obrigatória ausente para grupo ICMS resolvido.',
      { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW' },
    ));
  }

  if (icmsGroups.length > 1) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      'Mais de um grupo ICMS detectado — proibido.',
    ));
  }

  const shouldHaveGroup = csosnResolution?.resolved && cfopResolution?.resolved && xmlResolution?.resolved;
  if (shouldHaveGroup && icmsGroups.length === 0) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'Resolução completa exige exatamente um grupo ICMS.',
    ));
  }

  if (!shouldHaveGroup && icmsGroups.length > 0) {
    issues.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      'Grupo ICMS presente com resolução tributária incompleta.',
    ));
  }

  const referenceDate = context.operacao?.referenceDate ?? context.dataOperacao;
  for (const rule of appliedRules) {
    if (!isRuleEffectiveOn(rule, referenceDate)) {
      issues.push(createFiscalIssue(
        'RULE_CONFLICT',
        `Regra ${rule.id} fora de vigência para ${referenceDate}.`,
      ));
    }
  }

  for (const ref of ruleRefs) {
    if (!ref?.id) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'ruleRef inconsistente — id ausente.',
      ));
    }
  }

  return { issues };
};

/**
 * TaxTreatment — fatos combinados para resolução tributária (Fases 5+6).
 */
import { buildStScenarioKey } from './st-allocation.js';
import { CURRENT_OPERATION_ST } from './st-allocation.js';
import { deriveResolutionStatusFromIssues } from './resolution-status.js';

/**
 * @typedef {object} TaxTreatment
 * @property {string | null} operationType
 * @property {import('./item-source.js').ItemSource | null} itemSource
 * @property {'INTERNA' | 'INTERESTADUAL' | 'UNKNOWN' | null} location
 * @property {import('./item-source.js').IcmsTaxpayerStatus | null} recipientTaxpayerStatus
 * @property {boolean | null} [consumerFinal]
 * @property {import('./st-allocation.js').PriorStStatusValue | null} priorStStatus
 * @property {keyof typeof CURRENT_OPERATION_ST} currentOperationSt
 * @property {string | null} stScenarioKey
 * @property {import('./crt.js').Crt | null} crt
 * @property {string | null} referenceDate
 * @property {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} ruleRefs
 * @property {import('./resolution-status.js').ResolutionStatus} status
 * @property {import('./fiscal-issue.js').FiscalIssue[]} issues
 * @property {boolean} resolved
 */

/**
 * @param {object} context FiscalContext
 * @param {object} params
 */
export const buildTaxTreatment = (context, {
  currentOperationSt,
  ruleRefs = [],
  issues = [],
} = {}) => {
  const priorStStatus = context.allocation?.priorStStatus
    ?? context.estoque?.priorStStatus
    ?? null;
  const current = currentOperationSt ?? CURRENT_OPERATION_ST.UNKNOWN;
  const stScenarioKey = priorStStatus && current !== CURRENT_OPERATION_ST.UNKNOWN
    ? buildStScenarioKey(priorStStatus, current)
    : null;

  const treatmentIssues = [...issues];
  const treatment = {
    operationType: context.operacao?.operationType ?? context.operacao?.tipo ?? null,
    itemSource: context.item?.itemSource ?? null,
    location: context.operacao?.localizacao ?? null,
    recipientTaxpayerStatus: context.destinatario?.icmsTaxpayerStatus ?? null,
    consumerFinal: context.destinatario?.consumidorFinal ?? null,
    priorStStatus,
    currentOperationSt: current,
    stScenarioKey,
    crt: context.emitente?.crt ?? null,
    referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
    ruleRefs,
    status: deriveResolutionStatusFromIssues(treatmentIssues),
    issues: treatmentIssues,
    resolved: current !== CURRENT_OPERATION_ST.UNKNOWN,
  };

  return treatment;
};

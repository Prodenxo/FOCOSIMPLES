/**

 * Separação formal: match facts (observáveis) vs approved results (saída).

 */

import { createFiscalIssue } from '../types/fiscal-issue.js';

import { FORBIDDEN_MATCH_CONDITION_KEYS } from './constants.js';



export const detectForbiddenMatchConditions = (conditions = {}) => {

  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */

  const issues = [];

  for (const key of FORBIDDEN_MATCH_CONDITION_KEYS) {

    if (conditions[key] != null) {

      issues.push(createFiscalIssue(

        'FORBIDDEN_MATCH_CONDITION',

        `Condição "${key}" não permitida no matching — é resultado da resolução, não fato observável.`,

        { blocksEmission: true, overrideAllowed: false, meta: { field: key } },

      ));

    }

  }

  if (conditions.stApplicabilityStatus != null && !conditions.stApplicabilityProvenance) {

    issues.push(createFiscalIssue(

      'FORBIDDEN_MATCH_CONDITION',

      'stApplicabilityStatus exige stApplicabilityProvenance explícita.',

      { blocksEmission: true, overrideAllowed: false, meta: { field: 'stApplicabilityStatus' } },

    ));

  }

  return issues;

};



export const sanitizeMatchConditions = (conditions = {}, options = {}) => {

  /** @type {Record<string, unknown>} */

  const out = { ...conditions };

  for (const key of FORBIDDEN_MATCH_CONDITION_KEYS) {

    delete out[key];

  }

  if (!options.allowCatalogStApplicability) {

    delete out.stApplicabilityStatus;

    delete out.stApplicabilityProvenance;

  } else if (out.stApplicabilityStatus && !out.stApplicabilityProvenance) {

    delete out.stApplicabilityStatus;

  }

  return out;

};



export const getMatchConditionsFromRule = (rule, options = {}) => (

  sanitizeMatchConditions(rule.conditions ?? {}, options)

);



export const getApprovedResultFromRule = (rule) => ({ ...(rule.approvedResult ?? {}) });

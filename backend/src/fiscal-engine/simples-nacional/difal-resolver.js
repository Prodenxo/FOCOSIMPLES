/**
 * DIFAL — dimensão separada de ST (Fase 8B).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/** @typedef {'DUE' | 'NOT_DUE' | 'UNKNOWN'} DifalStatus */

/**
 * @typedef {object} DifalResolutionResult
 * @property {DifalStatus} status
 * @property {string[]} sourceRefs
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 */

/**
 * @param {object} context
 * @param {object} [options]
 * @param {boolean} [options.simplesNacionalOptant=true]
 */
export const resolveDifalFromContext = (context, { simplesNacionalOptant = true } = {}) => {
  const issuerUf = context.emitente?.uf ?? null;
  const destUf = context.operacao?.destinationUf ?? null;
  const location = context.operacao?.localizacao ?? null;
  const issues = [];

  if (simplesNacionalOptant) {
    issues.push(createFiscalIssue(
      'UNSUPPORTED_SCENARIO',
      'DIFAL para optante SN requer regra específica — mantido UNKNOWN.',
      { severity: 'REVIEW', blocksEmission: false, overrideAllowed: false },
    ));
    return { status: 'UNKNOWN', sourceRefs: ['lc-123-2006'], issues };
  }

  if (location === 'INTERNA' || (issuerUf && destUf && issuerUf === destUf)) {
    return { status: 'NOT_DUE', sourceRefs: [], issues };
  }

  if (issuerUf && destUf && issuerUf !== destUf) {
    return {
      status: 'UNKNOWN',
      sourceRefs: [],
      issues: [createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Operação interestadual sem regra DIFAL versionada.',
        { severity: 'REVIEW', blocksEmission: false, overrideAllowed: false },
      )],
    };
  }

  return { status: 'UNKNOWN', sourceRefs: [], issues };
};

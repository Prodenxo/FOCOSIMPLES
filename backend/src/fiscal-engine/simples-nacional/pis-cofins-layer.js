/**
 * PIS/COFINS — camada separada CSOSN para Simples Nacional (Fase 8B).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @param {object} context
 */
export const resolvePisCofinsSimplesNacional = (context) => {
  const crt = context.emitente?.crt ?? null;
  if (crt !== 1 && crt !== 4) {
    return {
      status: 'OUT_OF_SCOPE',
      pisCst: null,
      cofinsCst: null,
      issues: [],
    };
  }

  return {
    status: 'NOT_READY',
    pisCst: null,
    cofinsCst: null,
    sourceRefs: ['lc-123-2006'],
    issues: [
      createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Camada PIS/COFINS SN aguarda regras productionReady com fonte oficial.',
        { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
      ),
    ],
  };
};

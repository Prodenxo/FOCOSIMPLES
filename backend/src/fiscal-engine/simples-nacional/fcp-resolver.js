/**
 * FCP / FCP-ST — resolução separada por UF + vigência (Fase 8B).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @param {object} params
 * @param {string | null} params.issuerUf
 * @param {string | null} params.referenceDate
 * @param {number | null} [params.fcpRateFromRule]
 */
export const resolveFcpFromStateRule = ({ issuerUf, referenceDate, fcpRateFromRule }) => {
  if (fcpRateFromRule == null) {
    return {
      fcp: null,
      fcpSt: null,
      issues: [
        createFiscalIssue(
          'UNSUPPORTED_SCENARIO',
          `FCP ${issuerUf ?? '?'} sem alíquota versionada em ${referenceDate ?? '?'}.`,
          { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
        ),
      ],
    };
  }

  return {
    fcp: { rate: fcpRateFromRule },
    fcpSt: null,
    issues: [],
  };
};

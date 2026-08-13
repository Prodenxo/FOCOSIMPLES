/**
 * IPI — camada separada; Simples pode ter IPI aplicável em perfis específicos.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @param {object} context
 */
export const resolveIpiFromContext = (context) => {
  const ncm = context.produto?.ncm ?? null;
  if (!ncm) {
    return {
      status: 'NOT_APPLICABLE',
      ipiCst: null,
      issues: [],
    };
  }

  return {
    status: 'NOT_READY',
    ipiCst: null,
    sourceRefs: [],
    issues: [
      createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'IPI não resolvido — aguarda perfil/operação validados.',
        { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
      ),
    ],
  };
};

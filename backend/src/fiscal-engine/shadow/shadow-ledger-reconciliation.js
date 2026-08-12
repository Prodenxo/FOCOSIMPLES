/**
 * Reconciliação shadow ledger quando status mei_notas transiciona após consulta PlugNotas.
 * Fail-open — nunca altera emissão legado.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  isEmissionConfirmedForShadow,
  isEmissionRejectedForShadow,
  normalizeShadowEmissionStatus,
} from './shadow-emission-confirmation-policy.js';
import {
  promotePendingShadowLedgerToConfirmed,
  voidPendingShadowLedgerCommitments,
} from './shadow-stock-ledger.service.js';

const logReconcileFailOpen = (error, meta = {}) => {
  console.warn('[fiscal-shadow] ledger reconcile fail-open:', error instanceof Error ? error.message : error, meta);
};

/**
 * Transições permitidas (Fase 7A):
 * - PENDING_CONFIRMATION → CONFIRMED (autorização)
 * - PENDING_CONFIRMATION → VOIDED (rejeição/cancelamento/interrompido)
 *
 * @param {object} params
 */
export const reconcileShadowLedgerOnMeiNotaStatusChange = async (params) => {
  try {
    const meiNotaRecordId = params.meiNotaRecordId ?? null;
    const empresaId = params.empresaId ?? params.userId ?? null;
    if (!meiNotaRecordId || !empresaId) {
      return { reconciled: false, reason: 'missing_identity' };
    }

    const previousStatus = normalizeShadowEmissionStatus(params.previousStatus);
    const newStatus = normalizeShadowEmissionStatus(params.newStatus);

    if (previousStatus === newStatus) {
      return { reconciled: false, reason: 'status_unchanged' };
    }

    const shadowEmissionIdentity = String(meiNotaRecordId);

    if (isEmissionConfirmedForShadow(newStatus)) {
      return promotePendingShadowLedgerToConfirmed({
        empresaId,
        shadowEmissionIdentity,
        meiNotaRecordId,
        previousStatus,
        newStatus,
      });
    }

    if (isEmissionRejectedForShadow(newStatus)
      || newStatus === 'cancelado'
      || newStatus === 'interrompido') {
      return voidPendingShadowLedgerCommitments({
        empresaId,
        shadowEmissionIdentity,
        meiNotaRecordId,
        previousStatus,
        newStatus,
      });
    }

    return { reconciled: false, reason: 'no_ledger_transition', newStatus };
  } catch (error) {
    logReconcileFailOpen(error, {
      meiNotaRecordId: params.meiNotaRecordId,
      newStatus: params.newStatus,
    });
    return {
      reconciled: false,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
      issue: createFiscalIssue(
        'SHADOW_EXECUTION_ERROR',
        error instanceof Error ? error.message : String(error),
        { severity: 'INFO', blocksEmission: false },
      ),
    };
  }
};

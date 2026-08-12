/**
 * Lifecycle de reserva fiscal real — authoritative (Fase 3 APIs).
 */
import { ALLOCATION_STATUS } from '../allocation/allocation-constants.js';
import {
  releaseFiscalStockAllocation,
  consumeFiscalStockAllocation,
} from '../allocation/stock-allocation.service.js';
import { REQUEST_OUTCOME, RESERVATION_LIFECYCLE } from '../rollout/rollout-constants.js';

/**
 * Mapeamento conceitual:
 * RESERVED → AUTORIZADA → CONSUMED
 * RESERVED → REJEITADA → RELEASED
 * RESERVED → OUTCOME UNKNOWN → PENDING_SYNC (não release automático)
 *
 * @param {object} params
 */
export const resolveReservationTransition = (params) => {
  const outcome = params.requestOutcome ?? REQUEST_OUTCOME.UNKNOWN;
  const providerStatus = String(params.providerStatus ?? '').toLowerCase();
  const sentToProvider = params.sentToProvider === true;

  if (outcome === REQUEST_OUTCOME.NETWORK_ERROR || (outcome === REQUEST_OUTCOME.UNKNOWN && sentToProvider)) {
    return {
      action: 'HOLD',
      lifecycle: RESERVATION_LIFECYCLE.PENDING_SYNC,
      releaseReservation: false,
      reason: 'REQUEST_OUTCOME_UNKNOWN — reserva mantida até reconciliação',
    };
  }

  if (!sentToProvider && (outcome === REQUEST_OUTCOME.UNKNOWN || outcome === REQUEST_OUTCOME.REJECTED)) {
    return {
      action: 'RELEASE',
      lifecycle: RESERVATION_LIFECYCLE.RELEASED,
      releaseReservation: true,
      reason: 'Erro antes do envio ao provider — liberar reserva',
    };
  }

  if (outcome === REQUEST_OUTCOME.REJECTED
    || providerStatus.includes('rejeit')
    || providerStatus === 'rejeitado') {
    return {
      action: 'RELEASE',
      lifecycle: RESERVATION_LIFECYCLE.RELEASED,
      releaseReservation: true,
      reason: 'REJEITADA — liberar reserva',
    };
  }

  if (outcome === REQUEST_OUTCOME.SUCCESS
    || providerStatus.includes('autoriz')
    || providerStatus === 'concluido') {
    const isProcessing = providerStatus.includes('process') || providerStatus === 'processando';
    return {
      action: isProcessing ? 'HOLD' : 'CONSUME',
      lifecycle: isProcessing ? RESERVATION_LIFECYCLE.RESERVED : RESERVATION_LIFECYCLE.CONSUMED,
      releaseReservation: false,
      consumeReservation: !isProcessing,
      reason: isProcessing
        ? 'PROCESSANDO — manter reserva até terminal'
        : 'AUTORIZADA — consumir reserva',
    };
  }

  return {
    action: 'HOLD',
    lifecycle: RESERVATION_LIFECYCLE.RESERVED,
    releaseReservation: false,
    reason: 'Status intermediário — manter reserva',
  };
};

/**
 * @param {string} empresaId
 * @param {string} allocationRequestId
 * @param {object} transition
 */
export const applyReservationLifecycle = async (empresaId, allocationRequestId, transition) => {
  if (transition.releaseReservation) {
    return releaseFiscalStockAllocation(empresaId, allocationRequestId);
  }
  if (transition.consumeReservation) {
    return consumeFiscalStockAllocation(empresaId, allocationRequestId);
  }
  return { ok: true, held: true, status: ALLOCATION_STATUS.RESERVED };
};

/**
 * Erro de rede — NUNCA liberar reserva automaticamente.
 * @param {object} error
 */
export const classifyEmitRequestOutcome = (error) => {
  if (!error) return REQUEST_OUTCOME.SUCCESS;
  const message = error instanceof Error ? error.message : String(error);
  const code = error?.code ?? error?.cause?.code ?? '';

  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND'
    || /timeout|network|socket/i.test(message)) {
    return REQUEST_OUTCOME.NETWORK_ERROR;
  }

  if (/rejeit/i.test(message)) return REQUEST_OUTCOME.REJECTED;
  return REQUEST_OUTCOME.UNKNOWN;
};

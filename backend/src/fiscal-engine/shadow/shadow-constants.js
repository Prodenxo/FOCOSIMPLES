/**
 * Códigos de divergência shadow legado × v3 (Fase 7A).
 */
export const SHADOW_DIFFERENCE_CODE = Object.freeze({
  EXACT_MATCH: 'EXACT_MATCH',
  CFOP_DIFFERENT: 'CFOP_DIFFERENT',
  CSOSN_DIFFERENT: 'CSOSN_DIFFERENT',
  CST_DIFFERENT: 'CST_DIFFERENT',
  ORIGEM_DIFFERENT: 'ORIGEM_DIFFERENT',
  ICMS_GROUP_DIFFERENT: 'ICMS_GROUP_DIFFERENT',
  ICMS_BASE_DIFFERENT: 'ICMS_BASE_DIFFERENT',
  ICMS_VALUE_DIFFERENT: 'ICMS_VALUE_DIFFERENT',
  ST_DIFFERENT: 'ST_DIFFERENT',
  ITEM_SPLIT_DIFFERENT: 'ITEM_SPLIT_DIFFERENT',
  V3_UNRESOLVED: 'V3_UNRESOLVED',
  V3_BLOCKED: 'V3_BLOCKED',
  SHADOW_ALLOCATION_UNAVAILABLE: 'SHADOW_ALLOCATION_UNAVAILABLE',
  COMPARISON_AMBIGUOUS: 'COMPARISON_AMBIGUOUS',
  ROUNDING_ONLY_DIFFERENCE: 'ROUNDING_ONLY_DIFFERENCE',
  LEGACY_ONLY: 'LEGACY_ONLY',
  V3_ONLY: 'V3_ONLY',
});

export const SHADOW_EXECUTION_STATUS = Object.freeze({
  OK: 'OK',
  ERROR: 'ERROR',
  TIMEOUT: 'TIMEOUT',
  SKIPPED: 'SKIPPED',
});

export const CORRELATION_CONFIDENCE = Object.freeze({
  EXACT: 'EXACT',
  STRONG: 'STRONG',
  WEAK: 'WEAK',
  AMBIGUOUS: 'AMBIGUOUS',
});

export const DEFAULT_SHADOW_TIMEOUT_MS = 5000;

export const SHADOW_ALLOCATION_PLANNED_STATUS = 'PLANNED';

export const SHADOW_LEDGER_STATUS = Object.freeze({
  PLANNED: 'PLANNED',
  /** Observação aguardando autorização fiscal final — sem consumo virtual. */
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  VOIDED: 'VOIDED',
});

/** Issue observacional — plano stale entre planning e confirmation (race). */
export const SHADOW_LEDGER_ISSUE_CODE = Object.freeze({
  PLAN_STALE: 'SHADOW_LEDGER_PLAN_STALE',
});

/**
 * Lifecycle shadow ledger (Fase 7A):
 * - PLANNED: status interno de allocation shadow durante FIFO (não persistido como commitment de emissão)
 * - PENDING_CONFIRMATION: commitment persistido após emissão processando — reserva virtual para planning
 * - CONFIRMED: autorização fiscal final — consumo virtual oficial
 * - VOIDED: commitment liberado (rejeição/cancelamento) — futuro cancelamento pós-autorização
 *
 * Transições:
 *   (emissão processando) → PENDING_CONFIRMATION
 *   PENDING_CONFIRMATION → CONFIRMED | VOIDED
 *   CONFIRMED → VOIDED (futuro, requer evento fiscal confiável)
 */
export const SHADOW_LEDGER_LIFECYCLE_NOTE = 'PENDING reduz disponibilidade de planning; CONFIRMED reduz saldo consumido oficial.';

/**
 * Cancelamento fiscal posterior ainda exigirá reversão VOIDED no ledger — não implementado na Fase 7A.
 */
export const SHADOW_LEDGER_CANCELLATION_NOTE = 'VOIDED reservado para cancelamento fiscal futuro; reversão automática não implementada na Fase 7A.';

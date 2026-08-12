/**
 * Executor shadow — compara legado × v3 (Fase 7A hardening).
 * LEGACY = authoritative. V3 = observer.
 */
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { DEFAULT_RESOLVER_OPTIONS } from '../rules/fiscal-rule-execution-policy.js';
import { listFiscalRulesForEmpresa } from '../rules/fiscal-rule-memory.repository.js';
import { resolveFiscalFromContext } from '../resolution/resolve-fiscal-from-context.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { toDecimal } from '../money/decimal.js';
import { buildFiscalV3ShadowInput } from './build-fiscal-v3-shadow-input.js';
import { buildLegacyFiscalSnapshotsFromPayload } from './legacy-fiscal-snapshot.js';
import { buildV3FiscalSnapshotsFromResults } from './v3-fiscal-snapshot.js';
import {
  correlateAndCompareShadowItems,
  buildShadowComparisonSummary,
} from './fiscal-shadow-comparator.js';
import { persistShadowComparison, buildShadowIdempotencyKey } from './fiscal-shadow-persistence.js';
import { recordShadowComparisonMetrics } from './fiscal-shadow-metrics.js';
import {
  SHADOW_EXECUTION_STATUS,
  SHADOW_DIFFERENCE_CODE,
  DEFAULT_SHADOW_TIMEOUT_MS,
} from './shadow-constants.js';
import { assertShadowDoesNotAuthorizeEmission } from '../feature-flag.js';
import {
  getShadowTerminalState,
  tryMarkShadowTerminalState,
} from './shadow-execution-registry.js';
import {
  persistShadowStockLedgerFromPlans,
  withShadowTenantPlanningLock,
} from './shadow-stock-ledger.service.js';
import { SHADOW_LEDGER_STATUS, SHADOW_LEDGER_ISSUE_CODE } from './shadow-constants.js';
import { resolveShadowEmissionIdentity } from './shadow-emission-identity.js';
import {
  isEmissionConfirmedForShadow,
  normalizeShadowEmissionStatus,
} from './shadow-emission-confirmation-policy.js';

const cryptoRandomId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * @param {string | null} empresaId
 * @param {object[]} contexts
 */
export const assertShadowCrossTenantSafe = (empresaId, contexts) => {
  for (const ctx of contexts) {
    const ctxEmpresa = ctx?.empresaId ?? null;
    if (ctxEmpresa && empresaId && ctxEmpresa !== empresaId) {
      throw new Error('SHADOW_CROSS_TENANT: contexto fiscal de outra empresa.');
    }
  }
};

/**
 * @param {object} params
 */
export const runFiscalV3ShadowComparison = async (params) => {
  assertShadowDoesNotAuthorizeEmission();

  const comparisonId = params.comparisonId ?? cryptoRandomId();
  const timestamp = new Date().toISOString();
  const legacyPayloadSnapshot = params.legacyPayloadSnapshot ?? params.legacyPayload;
  const shadowEmissionIdentity = resolveShadowEmissionIdentity({
    shadowEmissionIdentity: params.shadowEmissionIdentity,
    idIntegracao: params.idIntegracao ?? legacyPayloadSnapshot?.idIntegracao,
    meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId,
    correlationId: params.correlationId ?? legacyPayloadSnapshot?.idIntegracao,
  });
  const executionKey = params.executionKey ?? buildShadowIdempotencyKey({
    empresaId: params.empresaId ?? params.userId ?? null,
    correlationId: params.correlationId ?? shadowEmissionIdentity ?? legacyPayloadSnapshot?.idIntegracao ?? null,
    emissionAttemptId: params.emissionAttemptId ?? comparisonId,
  });

  const existingTerminal = getShadowTerminalState(executionKey);
  if (existingTerminal && existingTerminal.comparisonId !== comparisonId) {
    return null;
  }

  const executionIssues = [];

  const normalizedEmissionStatus = normalizeShadowEmissionStatus(
    params.emissionStatus ?? params.providerStatus ?? null,
  );
  const emissionConfirmedForShadow = params.emissionConfirmedForShadow === true
    || (params.emissionConfirmedForShadow !== false && isEmissionConfirmedForShadow(normalizedEmissionStatus));
  const shouldConfirmLedger = params.confirmShadowLedger !== false && emissionConfirmedForShadow;
  const shadowLedgerTargetStatus = emissionConfirmedForShadow
    ? SHADOW_LEDGER_STATUS.CONFIRMED
    : SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION;

  try {
    const legacySnapshots = params.legacySnapshotsSync
      ?? buildLegacyFiscalSnapshotsFromPayload(legacyPayloadSnapshot);

    const tenantId = params.empresaId ?? params.userId ?? null;

    /** @type {object | null} */
    let ledgerResult = null;

    const shadowInput = await withShadowTenantPlanningLock(tenantId, async () => {
      const input = await buildFiscalV3ShadowInput({
        empresaId: tenantId,
        userId: params.userId ?? null,
        correlationId: params.correlationId ?? legacyPayloadSnapshot?.idIntegracao ?? null,
        emissionAttemptId: params.emissionAttemptId ?? params.correlationId ?? null,
        documentType: params.documentType ?? 'NFE',
        businessType: params.businessType ?? null,
        legacyPayloadSnapshot,
        metadata: params.metadata ?? {},
        lotFetcher: params.lotFetcher ?? null,
        inMemoryLotsByProduct: params.inMemoryLotsByProduct ?? null,
      });

      if (shouldConfirmLedger && input.itemPlans?.length) {
        ledgerResult = await persistShadowStockLedgerFromPlans({
          empresaId: input.empresaId,
          shadowEmissionIdentity,
          comparisonId,
          meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId ?? null,
          idIntegracao: params.idIntegracao ?? legacyPayloadSnapshot?.idIntegracao ?? null,
          itemPlans: input.itemPlans,
          ledgerStatus: SHADOW_LEDGER_STATUS.CONFIRMED,
        });
      } else if (
        normalizedEmissionStatus === 'processando'
        && input.itemPlans?.length
        && params.confirmShadowLedger !== false
      ) {
        ledgerResult = await persistShadowStockLedgerFromPlans({
          empresaId: input.empresaId,
          shadowEmissionIdentity,
          comparisonId,
          meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId ?? null,
          idIntegracao: params.idIntegracao ?? legacyPayloadSnapshot?.idIntegracao ?? null,
          itemPlans: input.itemPlans,
          ledgerStatus: SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
        });
      }

      return input;
    });

    executionIssues.push(...shadowInput.planningIssues);
    assertShadowCrossTenantSafe(shadowInput.empresaId, shadowInput.fiscalContexts);

    const resolverOptions = {
      ...DEFAULT_RESOLVER_OPTIONS,
      allowNonProductionRules: params.allowNonProductionRules === true,
      rules: params.rules,
    };
    const rules = params.rules ?? listFiscalRulesForEmpresa(shadowInput.empresaId);

    /** @type {import('../types/fiscal-result.js').FiscalResult[]} */
    let v3Results;
    if (Array.isArray(params.v3ResultsOverride)) {
      v3Results = params.v3ResultsOverride;
    } else if (shadowInput.fiscalContexts.length === 0) {
      v3Results = [];
    } else {
      v3Results = shadowInput.fiscalContexts.map((ctx) => resolveFiscalFromContext(ctx, {
        ...resolverOptions,
        rules,
      }));
    }

    const sourceItems = Array.isArray(legacyPayloadSnapshot?.itens) ? legacyPayloadSnapshot.itens : [];
    const v3Snapshots = buildV3FiscalSnapshotsFromResults(v3Results, sourceItems);

    let itemComparisons = correlateAndCompareShadowItems(legacySnapshots, v3Snapshots);

    for (const plan of shadowInput.itemPlans ?? []) {
      const unallocated = toDecimal(plan.unallocatedQuantity ?? '0');
      const hasPartialUnavailable = plan.partialPlan === true && unallocated.gt(0);
      if (!plan.plannedAllocations?.length || hasPartialUnavailable) {
        const legacySnap = legacySnapshots.find((l) => l.itemIndex === plan.itemIndex);
        if (legacySnap) {
          const existing = itemComparisons.find((c) => c.correlationKey === legacySnap.correlationKey);
          if (existing && !existing.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.SHADOW_ALLOCATION_UNAVAILABLE)) {
            existing.differenceCodes.push(SHADOW_DIFFERENCE_CODE.SHADOW_ALLOCATION_UNAVAILABLE);
            if (!plan.plannedAllocations?.length) {
              existing.differenceCodes.push(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED);
            }
            existing.exactMatch = false;
          }
        }
      }
    }

    const summary = buildShadowComparisonSummary(itemComparisons);

    /** @type {import('./shadow-types.js').FiscalShadowComparison} */
    const comparison = {
      comparisonId,
      empresaId: shadowInput.empresaId,
      userId: params.userId ?? null,
      timestamp,
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      legacyVersion: 'legacy-tax-service-v1',
      v3Version: ENGINE_SCHEMA_VERSION,
      correlationId: shadowInput.correlationId ?? shadowEmissionIdentity,
      emissionAttemptId: params.emissionAttemptId ?? comparisonId,
      executionStatus: SHADOW_EXECUTION_STATUS.OK,
      legacySnapshots,
      v3Snapshots,
      items: itemComparisons,
      summary,
      executionIssues,
      audit: {
        itemPlans: shadowInput.itemPlans,
        executionKey,
        emissionStatus: normalizedEmissionStatus,
        emissionConfirmedForShadow,
        shadowEmissionIdentity,
        shadowLedgerStatus: shouldConfirmLedger ? shadowLedgerTargetStatus : SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
        comparisonExecutionStatus: SHADOW_EXECUTION_STATUS.OK,
      },
    };

    if (getShadowTerminalState(executionKey)) {
      return null;
    }

    if (tryMarkShadowTerminalState(executionKey, {
      status: SHADOW_EXECUTION_STATUS.OK,
      comparisonId,
    })) {
      await persistShadowComparison(comparison);
      recordShadowComparisonMetrics(comparison);

      if (ledgerResult?.code === SHADOW_LEDGER_ISSUE_CODE.PLAN_STALE) {
        executionIssues.push(createFiscalIssue(
          SHADOW_LEDGER_ISSUE_CODE.PLAN_STALE,
          'Plano shadow stale — ledger não confirmado para evitar inconsistência.',
          { severity: 'INFO', blocksEmission: false, meta: ledgerResult.invariant ?? {} },
        ));
        comparison.audit.shadowLedgerStatus = SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION;
      } else if (ledgerResult?.persisted && ledgerResult?.ledgerStatus === SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION) {
        comparison.audit.shadowLedgerStatus = SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION;
      } else if (shouldConfirmLedger && ledgerResult?.persisted) {
        comparison.audit.shadowLedgerStatus = SHADOW_LEDGER_STATUS.CONFIRMED;
      } else if (shouldConfirmLedger && ledgerResult?.duplicate) {
        comparison.audit.shadowLedgerStatus = SHADOW_LEDGER_STATUS.CONFIRMED;
      } else if (!shouldConfirmLedger) {
        comparison.audit.shadowLedgerStatus = SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION;
      }
    }

    return comparison;
  } catch (error) {
    if (getShadowTerminalState(executionKey)) return null;

    executionIssues.push(createFiscalIssue(
      'SHADOW_EXECUTION_ERROR',
      error instanceof Error ? error.message : String(error),
      { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
    ));

    const comparison = {
      comparisonId,
      empresaId: params.empresaId ?? params.userId ?? null,
      userId: params.userId ?? null,
      timestamp,
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      legacyVersion: 'legacy-tax-service-v1',
      v3Version: ENGINE_SCHEMA_VERSION,
      correlationId: params.correlationId ?? legacyPayloadSnapshot?.idIntegracao ?? null,
      emissionAttemptId: params.emissionAttemptId ?? null,
      executionStatus: SHADOW_EXECUTION_STATUS.ERROR,
      legacySnapshots: params.legacySnapshotsSync ?? [],
      v3Snapshots: [],
      items: [],
      summary: {
        exactMatches: 0,
        differences: 0,
        legacyOnly: 0,
        v3Unresolved: 0,
        v3Blocked: 0,
        errors: 1,
        itemCount: 0,
      },
      executionIssues,
      audit: { executionKey },
    };

    if (tryMarkShadowTerminalState(executionKey, {
      status: SHADOW_EXECUTION_STATUS.ERROR,
      comparisonId,
    })) {
      await persistShadowComparison(comparison);
      recordShadowComparisonMetrics(comparison);
    }

    return comparison;
  }
};

/**
 * @param {object} params
 */
export const runFiscalV3ShadowComparisonWithTimeout = async (params) => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_SHADOW_TIMEOUT_MS;
  const comparisonId = cryptoRandomId();
  const legacyPayloadSnapshot = params.legacyPayloadSnapshot ?? params.legacyPayload;
  const shadowEmissionIdentity = resolveShadowEmissionIdentity({
    shadowEmissionIdentity: params.shadowEmissionIdentity,
    idIntegracao: params.idIntegracao ?? legacyPayloadSnapshot?.idIntegracao,
    meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId,
    correlationId: params.correlationId ?? legacyPayloadSnapshot?.idIntegracao,
  });
  const executionKey = buildShadowIdempotencyKey({
    empresaId: params.empresaId ?? params.userId ?? null,
    correlationId: params.correlationId ?? shadowEmissionIdentity ?? legacyPayloadSnapshot?.idIntegracao ?? null,
    emissionAttemptId: params.emissionAttemptId ?? comparisonId,
  });

  const timeoutComparison = {
    comparisonId,
    empresaId: params.empresaId ?? params.userId ?? null,
    userId: params.userId ?? null,
    timestamp: new Date().toISOString(),
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    legacyVersion: 'legacy-tax-service-v1',
    v3Version: ENGINE_SCHEMA_VERSION,
    correlationId: params.correlationId ?? legacyPayloadSnapshot?.idIntegracao ?? null,
    emissionAttemptId: params.emissionAttemptId ?? null,
    executionStatus: SHADOW_EXECUTION_STATUS.TIMEOUT,
    legacySnapshots: params.legacySnapshotsSync ?? [],
    v3Snapshots: [],
    items: [],
    summary: { exactMatches: 0, differences: 0, errors: 1, itemCount: 0 },
    executionIssues: [createFiscalIssue(
      'SHADOW_EXECUTION_ERROR',
      `Shadow timeout após ${timeoutMs}ms`,
      { severity: 'INFO', blocksEmission: false },
    )],
    audit: { executionKey, timedOut: true },
  };

  const workPromise = runFiscalV3ShadowComparison({
    ...params,
    legacyPayloadSnapshot,
    comparisonId: `${comparisonId}-work`,
    executionKey,
  });

  const result = await Promise.race([
    workPromise.then((value) => ({ kind: 'work', value })),
    new Promise((resolve) => {
      setTimeout(() => {
        tryMarkShadowTerminalState(executionKey, {
          status: SHADOW_EXECUTION_STATUS.TIMEOUT,
          comparisonId,
        });
        resolve({ kind: 'timeout', value: timeoutComparison });
      }, timeoutMs);
    }),
  ]);

  if (result.kind === 'timeout') {
    await persistShadowComparison(timeoutComparison);
    recordShadowComparisonMetrics(timeoutComparison);
    return timeoutComparison;
  }

  if (result.value) return result.value;

  const terminal = getShadowTerminalState(executionKey);
  if (terminal?.status === SHADOW_EXECUTION_STATUS.TIMEOUT) {
    return timeoutComparison;
  }

  return result.value ?? timeoutComparison;
};

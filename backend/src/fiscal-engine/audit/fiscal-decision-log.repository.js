/**
 * Persistência Postgres — fiscal_decision_logs (audit manual opening).
 */
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../../config/pg.js';
import { ensureFiscalPurchaseSchema, canAutoEnsureFiscalPurchaseSchema } from '../acquisition/fiscal-purchase.schema.js';

const maybeEnsureSchema = async () => {
  if (canAutoEnsureFiscalPurchaseSchema()) {
    await ensureFiscalPurchaseSchema();
  }
};

const jsonValue = (value) => {
  if (value == null) return null;
  return JSON.stringify(value);
};

/**
 * @param {object} params
 */
export const insertFiscalDecisionLog = async ({
  empresaId,
  userId,
  status = 'OK',
  contextSnapshot = {},
  automaticResult = {},
  issues = [],
  auditJson = {},
}) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO fiscal_decision_logs (
      id, empresa_id, user_id, status, context_json, automatic_result_json,
      final_result_json, issues_json, audit_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      empresaId,
      userId,
      status,
      jsonValue(contextSnapshot),
      jsonValue(automaticResult),
      jsonValue(automaticResult),
      jsonValue(issues),
      jsonValue(auditJson),
    ],
  );
  return { id };
};

/** @type {typeof insertFiscalDecisionLog | null} */
let repoOverride = null;

/** @internal testes */
export const __setFiscalDecisionLogRepoForTests = (fn) => {
  repoOverride = typeof fn === 'function' ? fn : null;
};

/** @internal testes */
export const __resetFiscalDecisionLogRepoForTests = () => {
  repoOverride = null;
};

export const persistFiscalDecisionLog = async (params) => (
  repoOverride ? repoOverride(params) : insertFiscalDecisionLog(params)
);

/**
 * Serviço fiscal — motor tributário dinâmico (matriz ST + `/tax/calculate-items`).
 */
import { Client } from 'pg';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { TAX_RULES_STATE_SCHEMA_SQL } from './db-bootstrap.service.js';
import {
  normalizeNcm,
  normalizeStMatrixRule,
  normalizeUf,
  resolveItemTaxFromStMatrix,
  sanitizeStMatrixApiResult,
} from '../lib/st-rules-engine.js';

const TAX_RULES_TABLE = 'tax_rules_state';

/** @type {Promise<{ ok: boolean }> | null} */
let schemaEnsureInFlight = null;
let schemaEnsured = false;

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

export const ensureTaxRulesStateSchema = async () => {
  if (schemaEnsured) return { ok: true, cached: true };
  if (schemaEnsureInFlight) return schemaEnsureInFlight;

  schemaEnsureInFlight = (async () => {
    const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
    if (!dbUrl) {
      throw badRequest('DATABASE_URL não configurado — não foi possível criar tax_rules_state.');
    }
    const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
    const client = new Client({
      connectionString: dbUrl,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await client.connect();
      await client.query(TAX_RULES_STATE_SCHEMA_SQL);
      schemaEnsured = true;
      return { ok: true };
    } finally {
      await client.end();
    }
  })();

  try {
    return await schemaEnsureInFlight;
  } finally {
    schemaEnsureInFlight = null;
  }
};

/** @internal testes */
export const __resetTaxRulesSchemaCacheForTests = () => {
  schemaEnsured = false;
  schemaEnsureInFlight = null;
};

const defaultGetDb = () => createSupabaseClient({ useServiceRole: true });
/** @type {null | (() => import('@supabase/supabase-js').SupabaseClient)} */
let getDbOverride = null;

/** @internal Apenas testes */
export const __setGetDbForTests = (fn) => {
  getDbOverride = typeof fn === 'function' ? fn : null;
};

export const __resetGetDbForTests = () => {
  getDbOverride = null;
};

const getDb = () => (getDbOverride ? getDbOverride() : defaultGetDb());

const TAX_RULES_SELECT = 'ncm, has_st, cfop_st, cest_default, cfop_interno, cfop_interestadual_pf';

/**
 * Busca regras da matriz ST em lote (par originUf → destinationUf).
 * @returns {Promise<Map<string, import('../lib/st-rules-engine.js').StMatrixRule>>}
 */
export const lookupStMatrixBatch = async ({
  ncms,
  originUf,
  destinationUf,
}) => {
  const orig = normalizeUf(originUf);
  const dest = normalizeUf(destinationUf);
  const uniqueNcms = [...new Set(
    (ncms || [])
      .map((ncm) => normalizeNcm(ncm))
      .filter((ncm) => ncm.length === 8),
  )];

  const map = new Map();
  if (!orig || !dest || uniqueNcms.length === 0) {
    return map;
  }

  await ensureTaxRulesStateSchema();

  const supabase = getDb();
  const { data, error } = await supabase
    .from(TAX_RULES_TABLE)
    .select(TAX_RULES_SELECT)
    .eq('origin_uf', orig)
    .eq('destination_uf', dest)
    .in('ncm', uniqueNcms);

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar matriz ST por UF');
  }

  for (const row of data || []) {
    const ncm = normalizeNcm(row.ncm);
    if (!ncm) continue;
    const stRule = normalizeStMatrixRule(row, ncm);
    if (stRule) map.set(ncm, stRule);
  }

  return map;
};

/** @deprecated alias — use lookupStMatrixBatch */
export const lookupTaxRulesStateBatch = lookupStMatrixBatch;

/**
 * Interestadual: se não houver regra origin→dest, usa ST da operação interna (origin→origin).
 * @param {Map<string, import('../lib/st-rules-engine.js').StMatrixRule>} directMap
 * @param {Map<string, import('../lib/st-rules-engine.js').StMatrixRule>} estadualMap
 */
export const mergeTaxRulesWithEstadualFallback = (directMap, estadualMap) => {
  const merged = new Map(directMap);
  for (const [ncm, estadualRule] of estadualMap) {
    if (merged.has(ncm)) continue;
    if (estadualRule) merged.set(ncm, estadualRule);
  }
  return merged;
};

/**
 * Calcula CSOSN/CFOP/CEST para vários itens (`POST /tax/calculate-items`).
 * @param {{ originUf: string, destinationUf: string, items: Array<{ ncm?: string, cest?: string }> }} input
 */
export const calculateItemsTax = async ({
  originUf,
  destinationUf,
  items,
  businessType,
  destinatarioDoc,
  destinatarioCpfCnpj,
  indIEDest,
  inscricaoEstadual,
  nonTaxpayer,
}) => {
  const orig = normalizeUf(originUf);
  const dest = normalizeUf(destinationUf);
  const list = Array.isArray(items) ? items : [];
  const destinatarioContext = {
    destinatarioDoc: destinatarioDoc ?? destinatarioCpfCnpj,
    indIEDest,
    inscricaoEstadual,
    nonTaxpayer,
  };

  let matrixMap = orig && dest
    ? await lookupStMatrixBatch({
      ncms: list.map((item) => item?.ncm),
      originUf: orig,
      destinationUf: dest,
    })
    : new Map();

  if (orig && dest && orig !== dest) {
    const estadualMap = await lookupStMatrixBatch({
      ncms: list.map((item) => item?.ncm),
      originUf: orig,
      destinationUf: orig,
    });
    matrixMap = mergeTaxRulesWithEstadualFallback(matrixMap, estadualMap);
  }

  return list.map((product) => {
    const ncm = normalizeNcm(product?.ncm);
    const stRule = ncm ? matrixMap.get(ncm) ?? null : null;
    const tax = resolveItemTaxFromStMatrix(
      product,
      orig,
      dest,
      stRule,
      businessType,
      destinatarioContext,
    );
    return sanitizeStMatrixApiResult(tax, product);
  });
};

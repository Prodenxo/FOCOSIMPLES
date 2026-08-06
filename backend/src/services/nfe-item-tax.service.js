import { Client } from 'pg';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { TAX_RULES_STATE_SCHEMA_SQL } from './db-bootstrap.service.js';
import {
  calculateItemTax,
  normalizeNcm,
  normalizeUf,
} from '../lib/nfe-item-tax-engine.js';

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

/**
 * Busca regras tributárias em lote (qualquer par originUf → destinationUf, inclusive interno).
 * @returns {Promise<Map<string, { hasSt: boolean, cfopSt: string|null }>>}
 */
export const lookupTaxRulesStateBatch = async ({
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
    .select('ncm, has_st, cfop_st')
    .eq('origin_uf', orig)
    .eq('destination_uf', dest)
    .in('ncm', uniqueNcms);

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar regras tributárias por UF');
  }

  for (const row of data || []) {
    const ncm = normalizeNcm(row.ncm);
    if (!ncm) continue;
    map.set(ncm, {
      hasSt: Boolean(row.has_st),
      cfopSt: row.cfop_st ? String(row.cfop_st).trim() : null,
    });
  }

  return map;
};

/**
 * Calcula CSOSN/CFOP para vários itens (formulário NF-e).
 * @param {{ originUf: string, destinationUf: string, items: Array<{ ncm?: string, cest?: string }> }} input
 */
export const calculateItemsTax = async ({ originUf, destinationUf, items }) => {
  const orig = normalizeUf(originUf);
  const dest = normalizeUf(destinationUf);
  const list = Array.isArray(items) ? items : [];

  const rulesMap = orig && dest
    ? await lookupTaxRulesStateBatch({
      ncms: list.map((item) => item?.ncm),
      originUf: orig,
      destinationUf: dest,
    })
    : new Map();

  return list.map((product) => {
    const ncm = normalizeNcm(product?.ncm);
    const stateRule = ncm ? rulesMap.get(ncm) ?? null : null;
    return calculateItemTax(product, orig, dest, stateRule);
  });
};

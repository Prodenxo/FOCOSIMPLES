/**
 * DDL e bootstrap idempotente — fiscal purchase / stock (Fase 2).
 * Em produção: usar migrations controladas pelo deploy — NÃO auto-DDL em request/startup.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { env } from '../../config/env.js';
import { badRequest } from '../../utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readMigration = (filename) => {
  const path = join(__dirname, '../../../supabase/migrations', filename);
  return readFileSync(path, 'utf8');
};

export const FISCAL_PURCHASE_PHASE2_SQL = readMigration('20260811200000_fiscal_purchase_stock_phase2.sql');
export const FISCAL_PURCHASE_HARDENING_SQL = readMigration('20260811210000_fiscal_purchase_hardening.sql');
export const FISCAL_STOCK_ALLOCATION_PHASE3_SQL = readMigration('20260812100000_fiscal_stock_allocation_phase3.sql');
export const FISCAL_ESTABLISHMENT_BOUNDARY_PHASE8F4_SQL = readMigration('20260817100000_fiscal_establishment_boundary_phase8f4.sql');
export const FISCAL_MANUAL_OPENING_STOCK_PHASE8F5_SQL = readMigration('20260817120000_fiscal_manual_opening_stock_phase8f5.sql');

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

/**
 * Auto-DDL permitido apenas em DEV/TEST ou flag administrativa explícita.
 */
export const canAutoEnsureFiscalPurchaseSchema = () => {
  const explicit = env.FISCAL_PURCHASE_SCHEMA_AUTO_ENSURE;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === '';
};

/**
 * @param {{ force?: boolean }} [options]
 */
export const ensureFiscalPurchaseSchema = async (options = {}) => {
  if (!options.force && !canAutoEnsureFiscalPurchaseSchema()) {
    throw badRequest(
      'ensureFiscalPurchaseSchema bloqueado em produção — aplique migrations via deploy',
    );
  }
  if (schemaEnsured) return { ok: true, cached: true };
  if (schemaEnsureInFlight) return schemaEnsureInFlight;

  schemaEnsureInFlight = (async () => {
    const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
    if (!dbUrl) {
      throw badRequest('DATABASE_URL não configurado — não foi possível criar schema fiscal purchase.');
    }
    const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
    const client = new Client({
      connectionString: dbUrl,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await client.connect();
      await client.query(FISCAL_PURCHASE_PHASE2_SQL);
      await client.query(FISCAL_PURCHASE_HARDENING_SQL);
      await client.query(FISCAL_STOCK_ALLOCATION_PHASE3_SQL);
      await client.query(FISCAL_ESTABLISHMENT_BOUNDARY_PHASE8F4_SQL);
      await client.query(FISCAL_MANUAL_OPENING_STOCK_PHASE8F5_SQL);
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
export const __resetFiscalPurchaseSchemaCacheForTests = () => {
  schemaEnsured = false;
  schemaEnsureInFlight = null;
};

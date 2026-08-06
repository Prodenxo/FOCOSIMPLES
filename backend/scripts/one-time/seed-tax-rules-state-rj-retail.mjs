/**
 * Seed idempotente: regras ST varejo RJ → RJ na tabela tax_rules_state.
 * Uso: node scripts/one-time/seed-tax-rules-state-rj-retail.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { TAX_RULES_STATE_SCHEMA_SQL } from '../../src/services/db-bootstrap.service.js';
import {
  dedupeTaxRuleSeedEntries,
  TAX_RULES_RJ_CFOP_ST,
  TAX_RULES_RJ_RETAIL_ST_ENTRIES,
  TAX_RULES_RJ_UF,
} from '../../src/data/tax-rules-state-rj-retail-seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

const dbUrl = String(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim();
if (!dbUrl) {
  console.error('[seed-tax-rules-rj] DATABASE_URL ausente no backend/.env');
  process.exit(1);
}

const sslEnabled = parseBoolean(process.env.DB_BOOTSTRAP_SSL, false);
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

const entries = dedupeTaxRuleSeedEntries(TAX_RULES_RJ_RETAIL_ST_ENTRIES);

await client.connect();
await client.query(TAX_RULES_STATE_SCHEMA_SQL);

let upserted = 0;
for (const entry of entries) {
  await client.query(
    `insert into public.tax_rules_state (ncm, origin_uf, destination_uf, has_st, cfop_st, updated_at)
     values ($1, $2, $3, true, $4, now())
     on conflict (ncm, origin_uf, destination_uf) do update set
       has_st = excluded.has_st,
       cfop_st = excluded.cfop_st,
       updated_at = now()`,
    [entry.ncm, TAX_RULES_RJ_UF, TAX_RULES_RJ_UF, TAX_RULES_RJ_CFOP_ST],
  );
  upserted += 1;
}

const { rows } = await client.query(
  `select count(*)::int as total
   from public.tax_rules_state
   where origin_uf = $1 and destination_uf = $1 and has_st = true`,
  [TAX_RULES_RJ_UF],
);

console.log('[seed-tax-rules-rj] ok', {
  uf: TAX_RULES_RJ_UF,
  upserted,
  totalStRj: rows[0]?.total ?? 0,
  segments: [...new Set(entries.map((e) => e.segment))],
});

await client.end();

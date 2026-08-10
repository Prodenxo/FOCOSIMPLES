/**
 * Aplica migration da matriz ST (cest_default, cfop_interno, cfop_interestadual_pf).
 * Uso: node scripts/one-time/apply-tax-rules-st-matrix.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const dbUrl = String(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim();
if (!dbUrl) {
  console.error('[apply-tax-rules-st-matrix] DATABASE_URL ausente');
  process.exit(1);
}

const sqlPath = path.join(
  backendRoot,
  'supabase/migrations/20260810120000_tax_rules_st_matrix_columns.sql',
);
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString: dbUrl, ssl: false });
await client.connect();
try {
  await client.query(sql);
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tax_rules_state'
       AND column_name IN ('cest_default', 'cfop_interno', 'cfop_interestadual_pf')
     ORDER BY 1`,
  );
  const count = await client.query(
    'SELECT count(*)::int AS c FROM public.tax_rules_state WHERE has_st = true',
  );
  console.log('[apply-tax-rules-st-matrix] ok', {
    columns: cols.rows.map((r) => r.column_name),
    stRulesTotal: count.rows[0]?.c ?? 0,
  });
} finally {
  await client.end();
}

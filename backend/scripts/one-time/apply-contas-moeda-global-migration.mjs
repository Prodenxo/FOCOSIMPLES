#!/usr/bin/env node
/**
 * Aplica a migration contas_moeda_global no Supabase (one-time).
 *
 * Uso (pasta Site/backend):
 *   node scripts/one-time/apply-contas-moeda-global-migration.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('SUPABASE_DB_URL ausente em Site/backend/.env')
  process.exit(1)
}

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260706120000_create_contas_moeda_global.sql',
)
const sql = fs.readFileSync(migrationPath, 'utf8')

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  console.log('Conectado. Aplicando migration contas_moeda_global…')
  await client.query(sql)
  const check = await client.query(
    `SELECT to_regclass('public.contas_moeda_global') AS table_ref`,
  )
  console.log('OK — tabela:', check.rows[0]?.table_ref ?? 'não encontrada')
} catch (err) {
  console.error('Falha:', err?.message ?? err)
  process.exit(1)
} finally {
  await client.end()
}

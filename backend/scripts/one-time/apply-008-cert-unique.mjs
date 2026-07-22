import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8')
const line = envText.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL ausente')
const connectionString = line.slice('DATABASE_URL='.length).trim()
const sql = fs.readFileSync(
  path.join(root, 'db/easypanel/008_certificados_unique_por_usuario.sql'),
  'utf8',
)

const client = new pg.Client({ connectionString })
await client.connect()
await client.query(sql)
const { rows } = await client.query(
  `SELECT indexname FROM pg_indexes
   WHERE tablename = 'user_mei_certificates' AND indexname LIKE '%ativo%'
   ORDER BY indexname`,
)
console.log('indexes:', rows.map((r) => r.indexname))
await client.end()

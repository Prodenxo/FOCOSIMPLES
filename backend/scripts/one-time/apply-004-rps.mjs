import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(backendRoot, '.env') })

const sqlPath = path.join(backendRoot, 'db/easypanel/004_nfse_rps_functions.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

await client.connect()
await client.query(sql)
const { rows } = await client.query(
  `SELECT proname FROM pg_proc WHERE proname LIKE 'mei_nfse_%' ORDER BY 1`,
)
console.log('ok', rows.map((r) => r.proname).join(', '))
await client.end()

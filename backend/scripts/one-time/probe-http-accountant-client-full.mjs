import { query } from '../../src/config/pg.js'
import { signLocalAccessToken } from '../../src/services/local-auth.service.js'

const EMPRESA_ID = 'ab799117-229d-46db-8ed6-7a2a91afb515'

const r = await query(
  `SELECT u.id, u.email FROM users u WHERE u.email = $1 LIMIT 1`,
  ['leo.irak@hotmail.com'],
)
const u = r.rows[0]
const token = signLocalAccessToken({ sub: u.id, email: u.email, role: 'authenticated' })
const headers = { Authorization: `Bearer ${token}` }

const paths = [
  '/accountant/clients',
  `/accountant/clients/${EMPRESA_ID}/establishments`,
  `/accountant/clients/${EMPRESA_ID}/products?limit=5`,
  `/accountant/clients/${EMPRESA_ID}/fiscal-configuration/rules`,
  `/accountant/clients/${EMPRESA_ID}/fiscal-configuration/readiness`,
]

for (const path of paths) {
  const res = await fetch(`http://localhost:3333/api${path}`, { headers })
  const text = await res.text()
  console.log('\n---', path, res.status, '---')
  console.log(text.slice(0, 800))
}

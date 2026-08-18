import { query } from '../../src/config/pg.js'
import { signLocalAccessToken } from '../../src/services/local-auth.service.js'

const r = await query(
  `SELECT u.id, u.email FROM users u WHERE u.email = $1 LIMIT 1`,
  ['leo.irak@hotmail.com'],
)
const u = r.rows[0]
if (!u) {
  console.error('user not found')
  process.exit(1)
}

const token = signLocalAccessToken({
  sub: u.id,
  email: u.email,
  role: 'authenticated',
})

const res = await fetch('http://localhost:3333/api/accountant/clients', {
  headers: { Authorization: `Bearer ${token}` },
})
console.log('HTTP', res.status, await res.text())

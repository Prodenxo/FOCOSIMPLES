import { query } from '../../src/config/pg.js'
import { signLocalAccessToken } from '../../src/services/local-auth.service.js'

const EMPRESA_ID = 'ab799117-229d-46db-8ed6-7a2a91afb515'

const r = await query(
  'SELECT u.id, u.email FROM users u WHERE u.email = $1 LIMIT 1',
  ['leo.irak@hotmail.com'],
)
const u = r.rows[0]
const token = signLocalAccessToken({ sub: u.id, email: u.email, role: 'authenticated' })
const headers = { Authorization: `Bearer ${token}` }

const clientsRes = await fetch('http://localhost:3333/api/accountant/clients', { headers })
const clients = await clientsRes.json()
console.log('EMITTERS:')
for (const c of clients.clients ?? []) {
  console.log('-', c.label, 'emitterUserId=', c.emitterUserId)
}

const allRes = await fetch(
  `http://localhost:3333/api/accountant/clients/${EMPRESA_ID}/products?limit=200&documentType=NFE`,
  { headers },
)
const all = await allRes.json()
console.log('\nALL products count:', all.products?.length)

const vetor = (clients.clients ?? []).find((c) => String(c.label || '').includes('VETOR'))
for (const client of clients.clients ?? []) {
  if (!client.emitterUserId) continue
  const filteredRes = await fetch(
    `http://localhost:3333/api/accountant/clients/${EMPRESA_ID}/products?limit=200&documentType=NFE&emitterUserId=${client.emitterUserId}`,
    { headers },
  )
  const filtered = await filteredRes.json()
  console.log(client.label?.split(' · ')[0], '=>', filtered.products?.length, 'produtos')
}

if (all.products?.length) {
  const byUser = {}
  for (const p of all.products) {
    byUser[p.user_id] = (byUser[p.user_id] ?? 0) + 1
  }
  console.log('\nALL by user_id:', byUser)
}

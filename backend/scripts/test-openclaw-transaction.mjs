/**
 * Teste rápido do endpoint OpenClaw (salário / entrada) sem curl nem JSON à mão.
 *
 * Uso (a partir da pasta `backend/`):
 *   node scripts/test-openclaw-transaction.mjs 55489991234567
 *   node scripts/test-openclaw-transaction.mjs 55489991234567 5000
 *
 * No `.env` do backend:
 *   OPENCLAW_WEBHOOK_SECRET=...   (obrigatório)
 *   OPENCLAW_ACTION_URL=...       (opcional; senão http://127.0.0.1:PORT/api/bot/openclaw/action)
 *   TEST_OPENCLAW_CLASSIFICACAO=Salário   (opcional)
 *
 * Para Easypanel / remoto, define OPENCLAW_ACTION_URL com a URL completa do POST.
 */
import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const todayIso = () => new Date().toISOString().slice(0, 10)

async function postAction (url, secret, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    console.error('Resposta não-JSON:', res.status, text.slice(0, 500))
    process.exit(1)
  }
  if (!res.ok || json.success === false) {
    console.error('Erro:', res.status, json.message || json.errors || json)
    process.exit(1)
  }
  return json
}

const phone = process.argv[2]?.replace(/\D/g, '')
const valor = Number(process.argv[3] ?? '3400')
const secret = (
  process.env.OPENCLAW_WEBHOOK_SECRET
  || process.env.HERMES_WEBHOOK_SECRET
  || ''
).trim()
const port = process.env.PORT || '3333'
const url = (
  (process.env.OPENCLAW_ACTION_URL || '').trim()
  || (process.env.HERMES_ACTION_URL || '').trim()
  || `http://127.0.0.1:${port}/api/bot/openclaw/action`
)
const classificacao = (
  process.env.TEST_OPENCLAW_CLASSIFICACAO
  || process.env.TEST_HERMES_CLASSIFICACAO
  || 'Salário'
).trim()

if (!phone) {
  console.error('Uso: node scripts/test-openclaw-transaction.mjs <telefone_só_digitos> [valor]')
  console.error('Ex.: node scripts/test-openclaw-transaction.mjs 55489991234567')
  process.exit(1)
}

if (!secret) {
  console.error('Define OPENCLAW_WEBHOOK_SECRET no .env do backend.')
  process.exit(1)
}

if (!Number.isFinite(valor) || valor <= 0) {
  console.error('Valor inválido.')
  process.exit(1)
}

console.log('URL:', url)
console.log('1) resolve_user …')
const r1 = await postAction(url, secret, { phone, action: 'resolve_user' })
console.log(JSON.stringify(r1, null, 2))

console.log('\n2) create_transaction (entrada / salário) …')
const r2 = await postAction(url, secret, {
  phone,
  action: 'create_transaction',
  payload: {
    tipo: 'entrada',
    valor,
    classificacao,
    data: todayIso(),
    status: 'pago',
    obs: 'teste script test-openclaw-transaction.mjs',
  },
})
console.log(JSON.stringify(r2, null, 2))
console.log('\nOK. Confere o lançamento na app.')

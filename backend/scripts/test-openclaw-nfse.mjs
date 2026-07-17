/**
 * Teste local do endpoint OpenClaw — NFSe (sem WhatsApp / sem OpenClaw).
 *
 * Pré-requisitos:
 *   cd Site/backend && npm run dev
 *   .env com OPENCLAW_WEBHOOK_SECRET, Supabase, telefone em n8n_link
 *
 * Uso (PowerShell — uma linha por comando ou use `;`):
 *   node scripts/test-openclaw-nfse.mjs setup 5521996185328
 *   node scripts/test-openclaw-nfse.mjs preview 5521996185328
 *   node scripts/test-openclaw-nfse.mjs emit 5521996185328
 *   node scripts/test-openclaw-nfse.mjs clientes 5521996185328
 *
 * Variáveis opcionais no .env:
 *   TEST_NFSE_TOMADOR_CNPJ=17422651000172
 *   TEST_NFSE_TOMADOR_NOME=Cliente Jose Ltda
 *   TEST_NFSE_VALOR=1200
 *   TEST_NFSE_DESCRICAO=consultoria
 *   TEST_NFSE_CODIGO_SERVICO=010701
 *   TEST_NFSE_CNAE=6201500
 *   OPENCLAW_ACTION_URL=http://127.0.0.1:3333/api/bot/openclaw/action
 */
import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

/** Evita assert libuv no Windows ao sair com fetch ainda a fechar. */
const exitOk = (code = 0) => {
  setTimeout(() => process.exit(code), 80)
}

async function postAction(url, secret, body) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const code = err?.cause?.code || err?.code || ''
    console.error('Falha de rede ao chamar a API:', code || err.message)
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
      console.error(`
O backend local não respondeu em:
  ${url}

1) Noutro terminal: cd Site/backend → npm run dev
2) Espere ver: [backend] rodando na porta ${port}
3) Se o servidor reiniciar (--watch), aguarde 2–3 s e tente de novo
4) Confirme PORT no .env (agora: ${port})
`)
    }
    process.exit(1)
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    console.error('Resposta não-JSON:', res.status, text.slice(0, 800))
    process.exit(1)
  }
  if (!res.ok || json.success === false) {
    console.error('Erro HTTP', res.status)
    console.error(JSON.stringify(json, null, 2))
    const msg = String(json.message || '')
    if (/Ação desconhecida.*get_nfse/i.test(msg) || /get_nfse_setup_status/.test(msg)) {
      console.error(`
Dica: o backend desta URL ainda NÃO tem as actions NFSe (deploy pendente).
  • Teste local: npm run dev + node scripts/test-openclaw-nfse.mjs --local setup <telefone>
  • Ou faça deploy do backend com openclaw-nfse.service.js e tente de novo no Easypanel.
`)
    }
    process.exit(1)
  }
  return json
}

const secret = (
  process.env.OPENCLAW_WEBHOOK_SECRET
  || process.env.HERMES_WEBHOOK_SECRET
  || ''
).trim()
const port = process.env.PORT || '3333'
const localUrl = `http://127.0.0.1:${port}/api/bot/openclaw/action`

const argv = process.argv.slice(2)
const useLocal =
  argv.includes('--local')
  || String(process.env.TEST_OPENCLAW_USE_LOCAL || '').toLowerCase() === 'true'
const filteredArgv = argv.filter((a) => a !== '--local')

const url = useLocal
  ? localUrl
  : (
    (process.env.OPENCLAW_ACTION_URL || '').trim()
    || (process.env.HERMES_ACTION_URL || '').trim()
    || localUrl
  )

const mode = (filteredArgv[0] || 'preview').toLowerCase()
const phone = filteredArgv[1]?.replace(/\D/g, '')
const notaIdArg = filteredArgv[2]?.trim()

const tomadorCnpj = (
  process.env.TEST_NFSE_TOMADOR_CNPJ
  || '17422651000172'
).replace(/\D/g, '')
const tomadorNome = (
  process.env.TEST_NFSE_TOMADOR_NOME
  || 'Cliente teste NFSe'
).trim()
const valorRaw = process.env.TEST_NFSE_VALOR || '1200'
const valor = Number(String(valorRaw).replace(',', '.'))
const descricao = (process.env.TEST_NFSE_DESCRICAO || 'consultoria').trim()
const codigoServico = (process.env.TEST_NFSE_CODIGO_SERVICO || '').trim()
const cnae = (process.env.TEST_NFSE_CNAE || '').trim()

const usage = () => {
  console.error(`
Uso: node scripts/test-openclaw-nfse.mjs <modo> <telefone_55>

Modos:
  setup     — get_nfse_setup_status (cadastro pronto?)
  preview   — preview_nfse (não emite)
  emit      — emit_nfse com confirm:true (emite na Plugnotas)
  clientes  — list_nfse_clientes
  list      — list_nfse_notas
  consult   — consult_nfse (precisa id da nota como 3º argumento)
  send-pdf  — send_nfse_whatsapp (3º arg = id da nota; nota concluida)

Flag:
  --local   — ignora OPENCLAW_ACTION_URL e usa http://127.0.0.1:PORT (npm run dev)

Ex.:
  node scripts/test-openclaw-nfse.mjs --local setup 5521996185328
  node scripts/test-openclaw-nfse.mjs --local preview 5521996185328
  node scripts/test-openclaw-nfse.mjs emit 5521996185328

Defina TEST_NFSE_* no Site/backend/.env para tomador/valor/descrição.
`)
  process.exit(1)
}

if (!phone) usage()
if (!secret) {
  console.error('Define OPENCLAW_WEBHOOK_SECRET em Site/backend/.env')
  process.exit(1)
}

const nfsePayload = () => {
  const p = {
    tomadorCpfCnpj: tomadorCnpj,
    tomadorRazaoSocial: tomadorNome,
    valor: valorRaw,
    descricao,
  }
  if (codigoServico) p.codigoServico = codigoServico
  if (cnae) p.cnae = cnae
  return p
}

console.log('URL:', url, useLocal ? '(--local)' : '')
const isRemote =
  !useLocal
  && !url.includes('127.0.0.1')
  && !url.includes('localhost')
if (isRemote) {
  console.log('AVISO: URL remota — precisa de deploy com código NFSe. Para dev use --local')
}
console.log('Modo:', mode, '| Telefone:', phone)
console.log('---')

if (mode === 'setup') {
  const r = await postAction(url, secret, { phone, action: 'get_nfse_setup_status' })
  console.log(JSON.stringify(r, null, 2))
  if (r.data?.setup?.ready) {
    console.log('\nOK — conta pronta para NFSe.')
  } else {
    console.log('\nIncompleto — complete na app MEI → Notas:', r.data?.setup?.missing)
  }
} else if (mode === 'clientes') {
  const r = await postAction(url, secret, {
    phone,
    action: 'list_nfse_clientes',
    payload: { q: process.env.TEST_NFSE_CLIENTES_Q || '' },
  })
  console.log(JSON.stringify(r, null, 2))
} else if (mode === 'list') {
  const r = await postAction(url, secret, {
    phone,
    action: 'list_nfse_notas',
    payload: { limit: 5 },
  })
  console.log(JSON.stringify(r, null, 2))
} else if (mode === 'preview') {
  console.log('resolve_user …')
  const u = await postAction(url, secret, { phone, action: 'resolve_user' })
  console.log('Conta:', u.data?.account?.displayName || u.message)

  console.log('\npreview_nfse …')
  const r = await postAction(url, secret, {
    phone,
    action: 'preview_nfse',
    payload: nfsePayload(),
  })
  console.log(JSON.stringify(r, null, 2))
  console.log('\nPara emitir de verdade: node scripts/test-openclaw-nfse.mjs --local emit', phone)
} else if (mode === 'consult') {
  if (!notaIdArg) {
    console.error('Uso: node scripts/test-openclaw-nfse.mjs --local consult <telefone> <nota-uuid>')
    process.exit(1)
  }
  const r = await postAction(url, secret, {
    phone,
    action: 'consult_nfse',
    payload: { id: notaIdArg, sync: true },
  })
  console.log(JSON.stringify(r, null, 2))
} else if (mode === 'emit') {
  if (!Number.isFinite(valor) || valor <= 0) {
    console.error('TEST_NFSE_VALOR inválido no .env')
    process.exit(1)
  }
  console.log('AVISO: vai chamar Plugnotas (nota real se ambiente de produção).')
  console.log('Payload:', JSON.stringify({ ...nfsePayload(), confirm: true }, null, 2))
  console.log('\nemit_nfse …')
  const r = await postAction(url, secret, {
    phone,
    action: 'emit_nfse',
    payload: { ...nfsePayload(), confirm: true },
  })
  console.log(JSON.stringify(r, null, 2))
  const notaId = r.data?.nota?.id
  console.log('\nOK. Confere status na app MEI → Notas.')
  if (notaId) {
    console.log(
      `Consultar: node scripts/test-openclaw-nfse.mjs --local consult ${phone} ${notaId}`,
    )
    console.log(
      `Enviar PDF (WhatsApp/Z-API): node scripts/test-openclaw-nfse.mjs consult ${phone} ${notaId} — depois send-pdf quando concluido`,
    )
  }
} else if (mode === 'send-pdf') {
  if (!notaIdArg) {
    console.error('Uso: node scripts/test-openclaw-nfse.mjs send-pdf <telefone> <nota-uuid>')
    process.exit(1)
  }
  const r = await postAction(url, secret, {
    phone,
    action: 'send_nfse_whatsapp',
    payload: { id: notaIdArg, sync: true },
  })
  console.log(JSON.stringify(r, null, 2))
} else {
  usage()
  process.exit(1)
}

exitOk(0)

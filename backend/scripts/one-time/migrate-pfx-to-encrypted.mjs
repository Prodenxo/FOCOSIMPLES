/**
 * One-time: cifra pfx_base64 legado → pfx_enc/pfx_iv/pfx_auth_tag (AES-256-GCM).
 * Uso: node scripts/one-time/migrate-pfx-to-encrypted.mjs [--dry-run]
 * Requer MEI_CERT_ENCRYPTION_KEY e DATABASE_URL.
 */
import 'dotenv/config'
import pg from 'pg'
import crypto from 'node:crypto'

const dryRun = process.argv.includes('--dry-run')
const keyRaw = process.env.MEI_CERT_ENCRYPTION_KEY || process.env.CERT_ENCRYPTION_KEY
if (!keyRaw) {
  console.error('MEI_CERT_ENCRYPTION_KEY obrigatória')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL obrigatória')
  process.exit(1)
}

const resolveKey = () => {
  const trimmed = String(keyRaw).trim()
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 44) {
    const buf = Buffer.from(trimmed, 'base64')
    if (buf.length === 32) return buf
  }
  const utf = Buffer.from(trimmed, 'utf8')
  if (utf.length === 32) return utf
  throw new Error('MEI_CERT_ENCRYPTION_KEY deve ter 32 bytes')
}

const key = resolveKey()

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const { rows } = await client.query(`
  SELECT id, user_id, pfx_base64
  FROM public.user_mei_certificates
  WHERE pfx_base64 IS NOT NULL
    AND (pfx_enc IS NULL OR pfx_enc = '')
`)

console.log(`Encontrados ${rows.length} certificados com pfx_base64 legado`)

let ok = 0
for (const row of rows) {
  try {
    const plain = Buffer.from(row.pfx_base64, 'base64')
    if (!plain.length) continue
    const enc = encrypt(plain)
    if (dryRun) {
      console.log(`[dry-run] would encrypt id=${row.id} user=${row.user_id} bytes=${plain.length}`)
      ok += 1
      continue
    }
    await client.query(
      `UPDATE public.user_mei_certificates
       SET pfx_enc = $1, pfx_iv = $2, pfx_auth_tag = $3, pfx_base64 = NULL, updated_at = now()
       WHERE id = $4`,
      [enc.ciphertext, enc.iv, enc.authTag, row.id],
    )
    ok += 1
    console.log(`ok id=${row.id}`)
  } catch (err) {
    console.error(`fail id=${row.id}`, err instanceof Error ? err.message : err)
  }
}

await client.end()
console.log(`Concluído: ${ok}/${rows.length}${dryRun ? ' (dry-run)' : ''}`)

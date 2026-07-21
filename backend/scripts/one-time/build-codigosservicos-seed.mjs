import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcCandidates = [
  path.resolve(
    __dirname,
    '../../../../.cursor/projects/c-Users-Usu-rio-Documents-Dev-FOCOSIMPLES/agent-tools/d78ef6c4-906f-414b-b21b-0c45c3783bd8.txt',
  ),
  'C:/Users/Usuário/.cursor/projects/c-Users-Usu-rio-Documents-Dev-FOCOSIMPLES/agent-tools/d78ef6c4-906f-414b-b21b-0c45c3783bd8.txt',
]
const src = srcCandidates.find((p) => fs.existsSync(p))
if (!src) {
  throw new Error(`Arquivo fonte LC116 não encontrado. Tentou:\n${srcCandidates.join('\n')}`)
}

const out = path.resolve(__dirname, '../../db/easypanel/005_seed_codigosservicos.sql')
const text = fs.readFileSync(src, 'utf8')
const rows = []
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/\|\s*(\d{6})\s*-\s*(.+?)\s*\|/)
  if (!m) continue
  const raw = m[1]
  const codigo = `${raw.slice(0, 2)}.${raw.slice(2, 4)}.${raw.slice(4, 6)}`
  const descricao = m[2].replace(/'/g, "''").trim()
  rows.push({ codigo, descricao })
}

if (rows.length < 50) {
  throw new Error(`Poucos códigos parseados (${rows.length}). Verifique o arquivo fonte.`)
}

const sql = [
  '-- Seed LC 116 / lista nacional NFS-e (portal gov.br)',
  '-- Formato codigo: II.SS.DD (ex.: 17.01.01) para busca por "17.01"',
  'BEGIN;',
  ...rows.map(
    (r) =>
      `INSERT INTO public.codigosservicos (codigo, descricao) VALUES ('${r.codigo}', '${r.descricao}') ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao;`,
  ),
  'COMMIT;',
  '',
].join('\n')

fs.writeFileSync(out, sql)
console.log(`OK: ${rows.length} códigos → ${out}`)
console.log('17.01:', rows.find((r) => r.codigo.startsWith('17.01')))
console.log('17.19:', rows.find((r) => r.codigo.startsWith('17.19')))

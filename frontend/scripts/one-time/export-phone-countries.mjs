import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libPath = path.resolve(__dirname, '../../node_modules/react-phone-input-2/lib/lib.js')
const ptPath = path.resolve(__dirname, '../../node_modules/react-phone-input-2/lang/pt.json')
const outPath = path.resolve(__dirname, '../../lib/phoneCountriesAll.generated.ts')

const lib = fs.readFileSync(libPath, 'utf8')
const ptNames = JSON.parse(fs.readFileSync(ptPath, 'utf8'))

const marker = '[[\"'
const start = lib.indexOf(marker)
if (start < 0) throw new Error('countries array not found')

let depth = 0
let end = start
for (let i = start; i < lib.length; i += 1) {
  const ch = lib[i]
  if (ch === '[') depth += 1
  if (ch === ']') {
    depth -= 1
    if (depth === 0) {
      end = i + 1
      break
    }
  }
}

const raw = JSON.parse(lib.slice(start, end))
function isoToFlagEmoji (iso) {
  const code = String(iso).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  const base = 0x1f1e6
  return String.fromCodePoint(
    ...code.split('').map((char) => base + char.charCodeAt(0) - 65),
  )
}

/** @type {Array<{ iso: string, name: string, dialCode: string, flag: string }>} */
const countries = raw
  .filter((row) => Array.isArray(row) && row[2] && row[3])
  .map((row) => {
    const iso = String(row[2]).toLowerCase()
    const dialCode = String(row[3]).replace(/\D/g, '')
    const name = ptNames[iso] || String(row[0])
    return {
      iso,
      name,
      dialCode,
      flag: isoToFlagEmoji(iso),
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

const br = countries.find((c) => c.iso === 'br')
const preferred = ['br', 'us', 'pt', 'ar', 'py', 'uy']
const ordered = [
  ...(br ? [br] : []),
  ...preferred
    .filter((iso) => iso !== 'br')
    .map((iso) => countries.find((c) => c.iso === iso))
    .filter(Boolean),
  ...countries.filter((c) => !preferred.includes(c.iso)),
]

const unique = []
const seen = new Set()
for (const c of ordered) {
  if (seen.has(c.iso)) continue
  seen.add(c.iso)
  unique.push(c)
}

const body = `/** Gerado por scripts/one-time/export-phone-countries.mjs — não editar à mão. */
import type { PhoneCountry } from './phoneCountries'

export const ALL_PHONE_COUNTRIES: PhoneCountry[] = ${JSON.stringify(unique, null, 2)} as PhoneCountry[]
`

fs.writeFileSync(outPath, body, 'utf8')
console.log('Wrote', unique.length, 'countries to', outPath)

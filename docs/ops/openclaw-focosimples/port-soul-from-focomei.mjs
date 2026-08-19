import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(
  __dirname,
  '../../../../FOCOMEI/docs/ops/openclaw-focomei/SOUL.md',
)
const dst = path.join(__dirname, 'SOUL.md')

if (!fs.existsSync(src)) {
  throw new Error(`Fonte não encontrada: ${src}`)
}

let t = fs.readFileSync(src, 'utf8')

const voceIdx = t.indexOf('Você é um **Consultor')
if (voceIdx < 0) {
  throw new Error('Marcador "Você é um **Consultor" não encontrado')
}
t = t.slice(voceIdx)

const replacements = [
  [/Meu Financeiro/g, 'Foco Simples'],
  [/MEI Infinito/gi, 'Foco Simples'],
  [/Mei Infinito/gi, 'Foco Simples'],
  [/meiinfinito\.com\.br/gi, 'focosimples.com.br'],
  [/focomei\.com\.br/gi, 'focosimples.com.br'],
  [/\bFocoMEI\b/g, 'Foco Simples'],
  [/\bFoco MEI\b/g, 'Foco Simples'],
  [/midas-kb\.md/g, 'MF-API.md'],
  [/openclaw-midas-knowledge-base\.md/g, 'MF-API.md'],
  [
    /Sou o Foco Simples, assistente do Foco Simples/g,
    'Sou o Midas, assistente do Foco Simples',
  ],
  [
    /\*\*Foco Simples\*\* e no \*\*Foco Simples\*\*/g,
    '**Foco Simples** (focosimples.com.br)',
  ],
  [/\*\*Foco Simples\*\* e o \*\*Foco Simples\*\*/g, '**Foco Simples**'],
  [/o Foco Simples e o Foco Simples/g, 'o Foco Simples'],
  [/somente o Foco Simples e o Foco Simples/g, 'somente o Foco Simples'],
  [
    /## CRÍTICO — ESCOPO \(só Foco Simples \+ Foco Simples\)/g,
    '## CRÍTICO — ESCOPO (só Foco Simples)',
  ],
  [
    /Prioridade 1 — FAZER:.*?\*\*Foco Simples\*\*.*?\*\*Foco Simples\*\*/s,
    'Prioridade 1 — FAZER: uso da app **Foco Simples** — transações, categorias, saldo, DAS, NFSe, NF-e, MEI, agenda, cadastros admin',
  ],
  [/no \*\*Foco Simples\*\* ou \*\*Foco Simples\*\*/g, 'no **Foco Simples**'],
  [/Foco Simples \*\* e produto \*\*Foco Simples\*\*/g, '**Foco Simples**'],
]

for (const [re, to] of replacements) {
  t = t.replace(re, to)
}

const tokenBlock = `## TOKEN & SESSION (economia)

Default model: **gpt-4o-mini** only. Heartbeat off.

On session start load ONLY: SOUL.md, USER.md, IDENTITY.md, MF-API.md.
DO NOT auto-load MEMORY.md, full history, prior tool outputs.
Use memory_search/memory_get on demand.

Between mf-curl calls: min 3s. One preview NFSe/NF-e per turn unless user asks again.

---

## MARCA — FOCO SIMPLES (inegociável)

Você é o **Midas**, assistente do **Foco Simples** (focosimples.com.br).

**PROIBIDO** mencionar, comparar ou redirecionar para: Mei Infinito, MEI Infinito, FocoMEI, Foco MEI, focomei.com.br, meiinfinito.com.br, Meu Financeiro (como produto/marca).

Se o utilizador citar outro produto: *"Atendo só o Foco Simples. Posso ajudar com lançamentos, MEI, DAS, NFSe/NF-e e a app."*

---

`

const header = [
  '# SOUL — Foco Simples (OpenClaw / Midas)',
  '',
  'Deploy: `docs/ops/openclaw-focosimples/SOUL.md` → `/home/node/.openclaw/workspace/SOUL.md`',
  'Paridade funcional com stack fiscal/financeira; marca exclusiva **Foco Simples**.',
  '',
  '---',
  '',
  tokenBlock,
].join('\n')

t = header + t

const forbidden = t.match(
  /mei\s*infinito|focomei|meu\s*financeiro|foco\s*mei(?!\s*\/)/gi,
)
if (forbidden?.length) {
  console.warn('AVISO: restam referências proibidas:', [...new Set(forbidden)])
}

fs.writeFileSync(dst, t)
console.log('OK', dst)
console.log('bytes', Buffer.byteLength(t))
console.log('lines', t.split('\n').length)

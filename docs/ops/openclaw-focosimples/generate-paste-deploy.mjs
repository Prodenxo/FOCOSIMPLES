import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const soulPath = path.join(__dirname, 'SOUL.md')
const apiPath = path.join(__dirname, 'MF-API.md')
const outPath = path.join(__dirname, 'paste-in-easypanel-console.sh')

const soul = fs.readFileSync(soulPath)
const b64 = soul.toString('base64')
const api = fs.readFileSync(apiPath)
const apiB64 = api.toString('base64')

const script = `#!/bin/sh
# Cole ESTE ficheiro inteiro no Console EasyPanel (OpenClaw) e execute: sh /tmp/paste-soul.sh
set -e
WS="\${OPENCLAW_WORKSPACE:-/home/node/.openclaw/workspace}"
mkdir -p "\$WS"
echo "[focosimples] a gravar SOUL.md (\${#} bytes b64)..."
printf '%s' '${b64}' | base64 -d > "\$WS/SOUL.md"
BYTES=\$(wc -c < "\$WS/SOUL.md")
echo "[focosimples] SOUL.md = \$BYTES bytes (esperado ~${soul.length})"
test "\$BYTES" -gt 50000 || { echo "ERRO: SOUL pequeno demais"; exit 1; }
grep -q 'send_text_whatsapp' "\$WS/SOUL.md" || { echo "ERRO: SOUL sem send_text_whatsapp"; exit 1; }
cat > "\$WS/IDENTITY.md" << 'IDEOF'
# IDENTITY
Nome: Midas
Papel: Assistente WhatsApp do Foco Simples (focosimples.com.br)
Proibido: Mei Infinito, FocoMEI, Meu Financeiro (como marca)
IDEOF
cat > "\$WS/USER.md" << 'UDEOF'
# USER
Timezone: America/Sao_Paulo
Produto: Foco Simples
Missão: Lançamentos, DAS, NFS-e/NF-e, agenda
UDEOF
printf '%s' '${apiB64}' | base64 -d > "\$WS/MF-API.md"
grep -q 'send_text_whatsapp' "\$WS/MF-API.md" || { echo "ERRO: MF-API sem send_text_whatsapp"; exit 1; }
echo "[focosimples] OK — Restart OpenClaw e /new no WhatsApp"
`

fs.writeFileSync(outPath, script)
console.log('Gerado:', outPath)
console.log('Tamanho script:', Buffer.byteLength(script), 'bytes')
console.log('SOUL original:', soul.length, 'bytes')

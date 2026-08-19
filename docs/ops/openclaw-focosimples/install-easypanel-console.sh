#!/bin/sh
# Foco Simples — instalar workspace OpenClaw no Console EasyPanel (serviço Running).
# Requer env: MF_API_URL + OPENCLAW_WEBHOOK_SECRET (iguais ao backend).
# SOUL completo: OPENCLAW_SOUL_RAW_URL → docs/ops/openclaw-focosimples/SOUL.md (Raw Git)
set -e

WS="${OPENCLAW_WORKSPACE:-/home/node/.openclaw/workspace}"
mkdir -p "$WS" /home/node/.openclaw

test -n "$MF_API_URL" && test -n "$OPENCLAW_WEBHOOK_SECRET" || {
  echo "ERRO: defina MF_API_URL e OPENCLAW_WEBHOOK_SECRET no EasyPanel → Ambiente → Restart"
  exit 1
}

MF_API_URL="$(printf '%s' "$MF_API_URL" | sed 's|//api/|/api/|g')"

echo "[focosimples] MF_API_URL=$MF_API_URL"
echo "[focosimples] workspace=$WS"

cat > "$WS/mf-curl-resolve-sender.cjs" << 'EOF'
const fs = require('fs');
const path = require('path');
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const valid = (v) => digits(v).length >= 10;
const workspaceDir = process.argv[2] || '/home/node/.openclaw/workspace';
const agentArg = process.argv[3] || '';
const pinPath = path.join(workspaceDir, '.mf-inbound-sender');
let pin = '';
try { if (fs.existsSync(pinPath)) pin = digits(fs.readFileSync(pinPath, 'utf8')); } catch (_) {}
const agent = digits(agentArg);
let sender = '';
if (valid(agent)) {
  sender = agent;
  try { fs.writeFileSync(pinPath, sender); } catch (_) {}
} else if (valid(pin)) {
  sender = pin;
} else {
  console.error('mf-curl: telefone remetente inválido (use DDI 55, >=10 dígitos)');
  process.exit(1);
}
process.stdout.write(sender);
EOF

MF_URL_ESC=$(printf "%s" "$MF_API_URL" | sed "s/'/'\\\\''/g")
MF_SEC_ESC=$(printf "%s" "$OPENCLAW_WEBHOOK_SECRET" | sed "s/'/'\\\\''/g")
cat > "$WS/mf-curl.sh" << CURL_EOF
#!/bin/sh
set -e
WS_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
AGENT_ARG="\${1:?mf-curl.sh: falta TELEFONE_REMETENTE (1º arg)}"
shift
JSON="\${1:?mf-curl.sh: falta JSON (2º arg)}"
MF_URL='$MF_URL_ESC'
MF_SEC='$MF_SEC_ESC'
SENDER="\$(node "\$WS_DIR/mf-curl-resolve-sender.cjs" "\$WS_DIR" "\$AGENT_ARG")" || exit 1
BODY="\$(node -e "
const sender=process.argv[1];
const raw=process.argv[2];
let j=JSON.parse(raw);
j.phone=String(sender).replace(/\\D/g,'');
console.log(JSON.stringify(j));
" "\$SENDER" "\$JSON")"
CURL_BIN="/usr/bin/curl"
if [ ! -x "\$CURL_BIN" ]; then
  CURL_BIN="\$(command -v curl 2>/dev/null || true)"
fi
if [ -z "\$CURL_BIN" ] || [ "\$CURL_BIN" = "\$0" ] || [ "\$CURL_BIN" = "\$WS_DIR/mf-curl.sh" ]; then
  echo "mf-curl: curl do sistema inválido ou aponta para mf-curl.sh (loop)" >&2
  exit 1
fi
exec "\$CURL_BIN" -sS --max-time 120 -X POST "\$MF_URL" \\
  -H 'Content-Type: application/json; charset=utf-8' \\
  -H "Authorization: Bearer \$MF_SEC" \\
  -H "X-WhatsApp-Sender: \$SENDER" \\
  -d "\$BODY"
CURL_EOF
chmod +x "$WS/mf-curl.sh"

cat > "$WS/mf-das.js" << 'NODE_EOF'
#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const phone = process.argv[2];
const mes = process.argv[3];
if (!phone || !mes) {
  console.error('uso: node mf-das.js 5521996185328 03/2026');
  process.exit(1);
}
const curl = path.join(dir, 'mf-curl.sh');
const body = JSON.stringify({ action: 'get_das_current', payload: { mes, includeBase64: true } });
const raw = execFileSync(curl, [phone, body], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let r;
try { r = JSON.parse(raw); } catch (e) {
  console.error(raw.slice(0, 500));
  process.exit(1);
}
if (!r.success) { console.log(raw); process.exit(1); }
const x = r.data || {};
if (!x.base64) {
  console.log(JSON.stringify({ success: false, message: 'sem PDF na API', apiMessage: r.message }));
  process.exit(1);
}
const fn = String(x.fileName || 'DAS.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
const p = '/tmp/' + fn;
fs.writeFileSync(p, Buffer.from(x.base64, 'base64'));
console.log(JSON.stringify({ success: true, mes: x.mes, fileName: fn, file: p }));
NODE_EOF
printf '#!/bin/sh\nexec node "%s/mf-das.js" "$@"\n' "$WS" > "$WS/mf-das.sh"
chmod +x "$WS/mf-das.js" "$WS/mf-das.sh"

cat > "$WS/mf-das-send.sh" << 'SEND_EOF'
#!/bin/sh
set -e
WS="$(cd "$(dirname "$0")" && pwd)"
PHONE="${1:?phone}"
MES="${2:?MM/YYYY}"
TARGET="${3:-$PHONE}"
OUT="$("$WS/mf-das.sh" "$PHONE" "$MES")" || { echo '{"success":false,"step":"mf-das.sh"}'; exit 1; }
FILE="$(echo "$OUT" | node -e "let j=JSON.parse(require('fs').readFileSync(0,'utf8'));if(!j.file)process.exit(1);process.stdout.write(j.file)")" || {
  echo "$OUT"; echo '{"success":false,"step":"parse"}'; exit 1
}
if ! openclaw message send --channel whatsapp --target "$TARGET" --media "$FILE" --message "DAS $MES" 2>/tmp/mf-das-send.err; then
  echo '{"success":false,"step":"openclaw message send"}'; exit 1
fi
echo "{\"success\":true,\"mes\":\"$MES\",\"file\":\"$FILE\",\"whatsapp\":\"sent\"}"
SEND_EOF
chmod +x "$WS/mf-das-send.sh"
cp "$WS/mf-das-send.sh" "$WS/mf-send-das.sh"

cat > "$WS/mf-nfse.js" << 'NODE_EOF'
#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const phone = process.argv[2];
const notaId = process.argv[3];
if (!phone || !notaId) {
  console.error('uso: node mf-nfse.js 5521... UUID');
  process.exit(1);
}
const curl = path.join(dir, 'mf-curl.sh');
const body = JSON.stringify({ action: 'get_nfse_pdf', payload: { notaId, id: notaId, includeBase64: true } });
const raw = execFileSync(curl, [phone, body], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let r;
try { r = JSON.parse(raw); } catch (e) {
  console.error(raw.slice(0, 500));
  process.exit(1);
}
if (!r.success) { console.log(raw); process.exit(1); }
const x = r.data || {};
const b64 = x.base64 || x.pdfBase64;
if (!b64) {
  console.log(JSON.stringify({ success: false, message: 'sem PDF', apiMessage: r.message }));
  process.exit(1);
}
const fn = String(x.fileName || ('NFSe-' + notaId + '.pdf')).replace(/[^a-zA-Z0-9._-]/g, '_');
const p = '/tmp/' + fn;
fs.writeFileSync(p, Buffer.from(b64, 'base64'));
console.log(JSON.stringify({ success: true, notaId, fileName: fn, file: p }));
NODE_EOF
printf '#!/bin/sh\nexec node "%s/mf-nfse.js" "$@"\n' "$WS" > "$WS/mf-nfse.sh"
chmod +x "$WS/mf-nfse.js" "$WS/mf-nfse.sh"

cat > "$WS/mf-nfse-send.sh" << 'SEND_EOF'
#!/bin/sh
set -e
WS="$(cd "$(dirname "$0")" && pwd)"
PHONE="${1:?phone}"
NOTA_ID="${2:?uuid}"
TARGET="${3:-$PHONE}"
OUT="$("$WS/mf-nfse.sh" "$PHONE" "$NOTA_ID")" || { echo '{"success":false,"step":"mf-nfse.sh"}'; exit 1; }
FILE="$(echo "$OUT" | node -e "let j=JSON.parse(require('fs').readFileSync(0,'utf8'));if(!j.file)process.exit(1);process.stdout.write(j.file)")" || {
  echo "$OUT"; exit 1
}
if ! openclaw message send --channel whatsapp --target "$TARGET" --media "$FILE" --message "Segue a NFS-e." 2>/tmp/mf-nfse-send.err; then
  echo '{"success":false,"step":"openclaw message send"}'; exit 1
fi
echo "{\"success\":true,\"notaId\":\"$NOTA_ID\",\"file\":\"$FILE\",\"whatsapp\":\"sent\"}"
SEND_EOF
chmod +x "$WS/mf-nfse-send.sh"

cat > "$WS/MF-API.md" << 'EOF'
# Foco Simples — API Bot
SEMPRE: /home/node/.openclaw/workspace/mf-curl.sh TELEFONE55 '{"action":"..."}'
DAS PDF: /home/node/.openclaw/workspace/mf-das-send.sh TELEFONE MM/YYYY
NFSe PDF: /home/node/.openclaw/workspace/mf-nfse-send.sh TELEFONE UUID
Só confirme envio com "whatsapp":"sent".
Marca: Foco Simples (focosimples.com.br). Proibido Mei Infinito / FocoMEI.
EOF

cat > "$WS/DAS-WHATSAPP.md" << 'EOF'
# DAS WhatsApp
exec: /home/node/.openclaw/workspace/mf-das-send.sh 5521... MM/YYYY
Proibido: curl, get_das_current no chat, só mf-das.sh.
EOF

cat > "$WS/IDENTITY.md" << 'EOF'
# IDENTITY
Nome: Midas
Papel: Assistente WhatsApp do Foco Simples (focosimples.com.br)
Proibido: Mei Infinito, FocoMEI, Meu Financeiro (como marca)
EOF

cat > "$WS/USER.md" << 'EOF'
# USER
Timezone: America/Sao_Paulo
Produto: Foco Simples
Missão: Lançamentos, DAS, NFS-e/NF-e, agenda
EOF

fetch_soul_md() {
  _url="$1"
  _dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$_url" -o "$_dest"
    return $?
  fi
  node -e "
const fs=require('fs');
const url=process.argv[1];
const dest=process.argv[2];
if(!url) { console.error('URL vazia'); process.exit(1); }
fetch(url).then(r=>{
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.text();
}).then(t=>{
  fs.mkdirSync(require('path').dirname(dest), { recursive: true });
  fs.writeFileSync(dest, t);
  console.log('[focosimples] SOUL via node fetch:', t.length, 'bytes');
}).catch(e=>{ console.error(e.message||e); process.exit(1); });
" "$_url" "$_dest"
}

if [ -n "${OPENCLAW_SOUL_RAW_URL:-}" ]; then
  echo "[focosimples] a baixar SOUL completo de OPENCLAW_SOUL_RAW_URL..."
  if fetch_soul_md "$OPENCLAW_SOUL_RAW_URL" "$WS/SOUL.md"; then
    wc -c "$WS/SOUL.md"
    echo "[focosimples] SOUL.md instalado ($(wc -c < "$WS/SOUL.md") bytes)"
  else
    echo "[focosimples] ERRO: download do SOUL falhou — mantém SOUL.md actual se existir"
  fi
elif [ -f "$WS/SOUL.md" ] && [ "$(wc -c < "$WS/SOUL.md")" -gt 20000 ]; then
  echo "[focosimples] SOUL.md já parece completo ($(wc -c < "$WS/SOUL.md") bytes) — ok"
else
  cat > "$WS/SOUL.md" << 'EOF'
# SOUL — Foco Simples (STUB)

Defina OPENCLAW_SOUL_RAW_URL com a URL Raw de docs/ops/openclaw-focosimples/SOUL.md
e reexecute este install — ou:

  curl -fsSL "$OPENCLAW_SOUL_RAW_URL" -o /home/node/.openclaw/workspace/SOUL.md
  wc -c /home/node/.openclaw/workspace/SOUL.md

Depois: Restart + /new no WhatsApp.
Marca exclusiva: Foco Simples. Proibido Mei Infinito / FocoMEI.
EOF
  echo "[focosimples] AVISO: SOUL stub instalado. Configure OPENCLAW_SOUL_RAW_URL e re-run."
fi

node -e '
const fs=require("fs");
const p="/home/node/.openclaw/openclaw.json";
let c={};
try{c=JSON.parse(fs.readFileSync(p,"utf8"));}catch(e){}
c.tools=c.tools||{};
c.tools.exec={host:"gateway",security:"full",ask:"off"};
c.tools.profile=c.tools.profile||"coding";
c.agents=c.agents||{};
c.agents.defaults=c.agents.defaults||{};
c.agents.defaults.model=c.agents.defaults.model||{primary:"openai/gpt-4o-mini"};
c.agents.defaults.heartbeat=c.agents.defaults.heartbeat||{};
c.agents.defaults.heartbeat.every=c.agents.defaults.heartbeat.every||"0m";
c.agents.defaults.bootstrapMaxChars=65000;
c.agents.defaults.bootstrapTotalMaxChars=160000;
c.channels=c.channels||{};
c.channels.whatsapp=c.channels.whatsapp||{};
c.channels.whatsapp.dmPolicy="open";
c.channels.whatsapp.allowFrom=["*"];
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log("[focosimples] tools.exec + bootstrapMaxChars=65000 ok");
'

echo "[focosimples] ping API..."
"$WS/mf-curl.sh" "5500000000000" '{"action":"ping"}' | head -c 400 || echo "(ping falhou — confira MF_API_URL/secret)"
echo ""
echo "[focosimples] OK. Ficheiros em $WS"
ls -la "$WS" | head -40
echo ""
echo "Próximo: Restart OpenClaw. Teste WhatsApp com telefone ligado."
echo "Smoke: $WS/mf-curl.sh SEU_TELEFONE55 '{\"action\":\"resolve_user\"}'"

# OpenClaw Foco Simples — SOUL + workspace

Pacote para o serviço **`openclaw-focosimples`** no Easypanel.

## Gerar / atualizar SOUL

```bash
node docs/ops/openclaw-focosimples/port-soul-from-focomei.mjs
```

Fonte: `FOCOMEI/docs/ops/openclaw-focomei/SOUL.md` (paridade funcional).

## Deploy no OpenClaw (Easypanel Console)

O container OpenClaw **não** tem o repo em `/app`. Use **curl do GitHub** (não caminho local).

### 1. SOUL + docs (copiar e colar no Console)

```sh
WS=/home/node/.openclaw/workspace
mkdir -p "$WS"
BASE=https://raw.githubusercontent.com/Prodenxo/FOCOSIMPLES/main/docs/ops/openclaw-focosimples
curl -fsSL "$BASE/SOUL.md" -o "$WS/SOUL.md"
curl -fsSL "$BASE/IDENTITY.md" -o "$WS/IDENTITY.md"
curl -fsSL "$BASE/USER.md" -o "$WS/USER.md"
curl -fsSL "$BASE/MF-API.md" -o "$WS/MF-API.md"
wc -c "$WS/SOUL.md"
```

`wc -c` deve dar **~61676**, não ~1747 (stub).

### 2. Workspace completo (mf-curl, DAS, NFSe)

```sh
curl -fsSL https://raw.githubusercontent.com/Prodenxo/FOCOSIMPLES/main/docs/ops/openclaw-focosimples/install-easypanel-console.sh | sh
```

Requer env `MF_API_URL` + `OPENCLAW_WEBHOOK_SECRET`. Opcional: `OPENCLAW_SOUL_RAW_URL` com a mesma URL `$BASE/SOUL.md`.

### Erro 404 no curl

`OPENCLAW_SOUL_RAW_URL` provavelmente aponta para branch/path errado. Use a URL acima ou confira se `main` no GitHub já tem os ficheiros.

### Alternativa offline

```bash
node docs/ops/openclaw-focosimples/generate-paste-deploy.mjs
# gera paste-in-easypanel-console.sh (~83 KB) para colar no Console
```

3. **Restart** OpenClaw → WhatsApp **`/new`**

## Marca

- Assistente: **Midas**
- Produto: **Foco Simples** apenas
- **Proibido** no chat: Mei Infinito, FocoMEI, Meu Financeiro (como marca)

## Smoke

```bash
/home/node/.openclaw/workspace/mf-curl.sh TELEFONE55 '{"action":"ping"}'
/home/node/.openclaw/workspace/mf-curl.sh TELEFONE55 '{"action":"resolve_user"}'
```

## Z-API → Backend → OpenClaw → Z-API (sem WhatsApp nativo no OpenClaw)

Fluxo recomendado (1 número = Z-API only):

```
Cliente ↔ Z-API ↔ Backend (/api/webhooks/zapi/inbound)
                    ↓ POST /hooks/agent (waitForResult)
                 OpenClaw (Midas + SOUL)
                    ↓ texto
                 Backend → Z-API send-text → Cliente
```

### Backend (Easypanel)

```env
WHATSAPP_OUTBOUND_MODE=zapi
ZAPI_INSTANCE_ID=...
ZAPI_TOKEN=...
ZAPI_CLIENT_TOKEN=...
ZAPI_WEBHOOK_TOKEN=...

OPENCLAW_PUBLIC_ORIGIN=https://auto-openclaw-focosimples.4tnf3f.easypanel.host
OPENCLAW_ZAPI_RELAY_URL=https://auto-openclaw-focosimples.4tnf3f.easypanel.host/hooks/agent
OPENCLAW_ZAPI_RELAY_SECRET=token-hooks-openclaw
OPENCLAW_ZAPI_RELAY_SYNC=true
OPENCLAW_ZAPI_RELAY_TIMEOUT_MS=120000
```

Webhook Z-API:

```
https://auto-focosimplesbackend.4tnf3f.easypanel.host/api/webhooks/zapi/inbound?token=...
```

Monitor: `GET /api/webhooks/zapi/monitor` → `inboundBridgeVersion: 7`, `openclaw_zapi_sync_relay`.

### OpenClaw (openclaw.json)

```json
"hooks": {
  "enabled": true,
  "token": "token-hooks-openclaw",
  "path": "/hooks"
}
```

(O backend **não** envia `sessionKey` — compatível com o padrão OpenClaw. Opcional: `allowRequestSessionKey: true` se quiser sessões por telefone no futuro.)

**Não** activar `channels.whatsapp` (evita ban com Z-API no mesmo número).

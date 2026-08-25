# Modo dual QR — OpenClaw + Z-API (mesmo número)

Como FocoMEI / Meu Financeiro: **OpenClaw responde o chat**, **Z-API manda automático** (DAS dia 01, agenda).

## 1. Backend (Easypanel)

```env
WHATSAPP_DUAL_QR_MODE=true
WHATSAPP_OUTBOUND_MODE=zapi
ZAPI_INSTANCE_ID=...
ZAPI_TOKEN=...
ZAPI_CLIENT_TOKEN=...
ZAPI_WEBHOOK_TOKEN=...

MEI_DAS_AUTO_WHATSAPP_ENABLED=true
AGENDA_WHATSAPP_REMINDERS_ENABLED=true

# relay OFF — chat é do OpenClaw, não do backend
OPENCLAW_ZAPI_RELAY_SYNC=false
```

Monitor: `GET /api/webhooks/zapi/monitor` → `whatsappDualQrMode: true`

## 2. OpenClaw (Console)

```sh
export OPENCLAW_DUAL_QR=true
curl -fsSL https://raw.githubusercontent.com/Prodenxo/FOCOSIMPLES/main/docs/ops/openclaw-focosimples/install-easypanel-console.sh | sh
```

Depois:

```sh
openclaw channels login
# escaneia QR
```

Restart → `/new` no WhatsApp.

### Se `status --probe` mostrar `dm:disabled`

DMs bloqueados — cola no Console:

```sh
node -e '
const fs=require("fs");
const p="/home/node/.openclaw/openclaw.json";
const c=JSON.parse(fs.readFileSync(p,"utf8"));
c.channels=c.channels||{};
c.channels.whatsapp=c.channels.whatsapp||{};
c.channels.whatsapp.enabled=true;
c.channels.whatsapp.dmPolicy="open";
c.channels.whatsapp.allowFrom=["*"];
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log("whatsapp dm:", c.channels.whatsapp);
'
```

Restart OpenClaw → `openclaw channels status --probe` deve mostrar **`dm:open`**.


1. Conecta o **mesmo número** (segundo QR)
2. Webhook continua apontando pro backend (comandos admin `mf pendentes` etc.)
3. Com dual mode, webhook **não** responde chat — só OpenClaw responde

## Teste rápido

| Teste | Como |
|-------|------|
| Chat | Manda "saldo" → resposta do **OpenClaw** (Midas) |
| Sem duplicata | Uma resposta só, não duas |
| Saída Z-API | Admin envia DAS manual ou espera dia 01 |
| Monitor | `whatsappDualQrMode: true`, `openclawRelaySync: false` |

## Smoke OpenClaw

```sh
/home/node/.openclaw/workspace/mf-curl.sh 5521996185328 '{"action":"ping"}'
```

## Se der ban / conflito

Volta pro modo relay (só Z-API, sem QR OpenClaw) — ver secção anterior no README.

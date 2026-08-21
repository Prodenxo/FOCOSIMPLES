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

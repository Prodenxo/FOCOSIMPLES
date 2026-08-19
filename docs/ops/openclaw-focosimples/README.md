# OpenClaw Foco Simples — SOUL + workspace

Pacote para o serviço **`openclaw-focosimples`** no Easypanel.

## Gerar / atualizar SOUL

```bash
node docs/ops/openclaw-focosimples/port-soul-from-focomei.mjs
```

Fonte: `FOCOMEI/docs/ops/openclaw-focomei/SOUL.md` (paridade funcional).

## Deploy no OpenClaw (Easypanel Console)

1. Copie `SOUL.md`, `USER.md`, `IDENTITY.md`, `MF-API.md` para `/home/node/.openclaw/workspace/`
2. Ou defina `OPENCLAW_SOUL_RAW_URL` (URL Raw do Git) e:

```bash
curl -fsSL "$OPENCLAW_SOUL_RAW_URL" -o /home/node/.openclaw/workspace/SOUL.md
wc -c /home/node/.openclaw/workspace/SOUL.md
```

Deve dar **~50 KB**, não ~1 KB.

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

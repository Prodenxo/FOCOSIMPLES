# WhatsApp: teste do robô no backend (só o dono)

Status: InProgress

## Objetivo

Permitir que o superadmin ligue/desligue o OpenClaw **só no próprio WhatsApp**, pelo site. Os clientes continuam no OpenClaw.

## Como funciona

- Interruptor **ligado** = OpenClaw (como hoje)
- Interruptor **desligado** = backend + OpenAI no número do próprio usuário
- Só aparece para superadmin
- Sem telefone no perfil, avisa e não troca o fluxo dos outros

## Critérios

1. Cliente sem o interruptor continua no OpenClaw
2. Superadmin com interruptor desligado: mensagens do seu WhatsApp vão para o backend
3. Superadmin pode religar e voltar ao OpenClaw na hora
4. Lançamento, correção, agenda, DAS e nota usam as ações que já existem
5. Pedido de saldo consulta a conta de verdade (não responde "não consigo")
6. Logs ficam atrás de um botão, com escolha do número

## File List

- `backend/src/prompts/midas-soul.md`
- `backend/src/services/openclaw-actions.js`
- `backend/src/services/openclaw-period.js`
- `backend/src/services/openclaw-bot.service.js`
- `backend/src/services/whatsapp-backend-agent-intent.js`
- `backend/src/services/whatsapp-backend-agent-prompt.js`
- `backend/src/services/whatsapp-backend-agent.service.js`
- `backend/src/services/openclaw-nf-user-messages.js`
- `backend/src/services/openclaw-nfse.service.js`
- `backend/tests/openclaw-nfse.service.test.js`
- `backend/tests/whatsapp-backend-agent-actions.test.js`
- `docs/ops/openclaw-focosimples/SOUL.md`
- `frontend/components/settings/WhatsappAgentLogsModal.tsx`
- `frontend/screens/SettingsScreen.tsx`

## Dev Notes

- [x] Tratar resposta numérica após lista de serviços como `servicoIndice`.
- [x] Impedir nova listagem após escolha válida e impedir edição de arquivos pelo robô.
- [x] Permitir escolher cliente homónimo por número (`tomadorIndice`) e devolver os documentos reais na mensagem de erro.
- [ ] Publicar o SOUL atualizado no OpenClaw e validar pelo WhatsApp.

## Change Log

- 2026-09-16 — Reaberta para corrigir escolha numérica de serviço NFS-e no WhatsApp.
- 2026-09-16 — Corrigido loop de clientes homónimos (`NFSE_TOMADOR_AMBIGUOUS`) e CNPJ inventado pelo agente.

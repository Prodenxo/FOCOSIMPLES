# WhatsApp: teste do robô no backend (só o dono)

Status: InReview

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

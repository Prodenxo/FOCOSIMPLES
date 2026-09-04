# Painel de gasto OpenAI (só superadmin)

Status: InReview

## Objetivo

O dono vê, só no próprio perfil, quanto a OpenAI está gastando: tokens, chamadas e estimativa em real, somando todos os usuários que passam pelo backend.

## Critérios

1. Só superadmin enxerga o painel em Configurações
2. Cada resposta do robô do site e cada transcrição OpenAI grava tokens/custo
3. O painel mostra total do período e o detalhe por telefone
4. Real usa câmbio do dia (estimativa; a fatura da OpenAI continua em dólar)

## File List

- `backend/src/lib/openai-pricing.js`
- `backend/src/services/openai-usage.service.js`
- `backend/src/controllers/openai-usage.controller.js`
- `backend/src/routes/admin.routes.js`
- `backend/src/services/whatsapp-backend-agent.service.js`
- `backend/src/services/whatsapp-audio-transcription.service.js`
- `frontend/components/settings/OpenaiUsageModal.tsx`
- `frontend/services/openaiUsageService.ts`
- `frontend/screens/SettingsScreen.tsx`

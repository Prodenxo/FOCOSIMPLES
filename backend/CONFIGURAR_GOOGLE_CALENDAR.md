# Configuração Rápida - Google Calendar OAuth

Este guia explica como configurar o redirecionamento após autenticação Google Calendar.

## Passo 1: Configurar FRONTEND_URL no Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral: **Edge Functions**
4. Clique em: **google-calendar**
5. Vá em: **Settings** → **Secrets**
6. Clique em: **Add new secret**
7. Adicione:
   - **Nome**: `FRONTEND_URL`
   - **Valor**: 
     - Desenvolvimento: `http://localhost:5173`
     - Produção: `https://seu-dominio.com` (sem barra no final)
8. Clique em: **Save**

## Passo 2: Verificar Deploy

Se você já fez deploy recentemente, pode pular este passo.

Para fazer deploy:

```bash
cd backend
supabase functions deploy google-calendar
```

Ou use o script:
- **Windows**: `deploy-functions.bat [SEU_PROJECT_REF]`
- **Linux/Mac**: `./deploy-functions.sh [SEU_PROJECT_REF]`

## Passo 3: Testar

1. Inicie o frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Acesse: `http://localhost:5173/settings`

3. Clique em: **Conectar Google Calendar**

4. Autorize no Google

5. **Resultado esperado**: Você será redirecionado automaticamente para `/settings` no seu frontend

## Variáveis Necessárias

Certifique-se de que todas estas variáveis estão configuradas no Supabase:

- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET`
- ✅ `GOOGLE_REDIRECT_URI` (ex: `https://[PROJECT_REF].supabase.co/functions/v1/google-calendar/callback`)
- ✅ `FRONTEND_URL` (ex: `http://localhost:5173`)

## Troubleshooting

### Ainda aparece página HTML do Supabase

- Verifique se `FRONTEND_URL` está configurada
- Aguarde alguns segundos após salvar (pode levar tempo para aplicar)
- Verifique os logs da Edge Function no Supabase Dashboard

### Redireciona para URL errada

- Verifique se `FRONTEND_URL` está sem barra no final
- Certifique-se de incluir o protocolo (`http://` ou `https://`)

### Erro 404 ao redirecionar

- Verifique se o frontend está rodando
- Em desenvolvimento, certifique-se de que está na porta correta (geralmente 5173)

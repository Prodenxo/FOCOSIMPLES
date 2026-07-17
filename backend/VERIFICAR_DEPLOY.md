# Como Verificar se a Edge Function está Deployada

## Método 1: Painel do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em: **Edge Functions**
4. Verifique se **google-calendar** aparece na lista
5. Clique em **google-calendar** para ver detalhes
6. Vá em **Logs** para ver se há erros recentes

## Método 2: Testar Endpoint

Teste se a função está respondendo:

```bash
# Substitua [PROJECT_REF] e [ANON_KEY] pelos seus valores
curl -X OPTIONS \
  https://[PROJECT_REF].supabase.co/functions/v1/google-calendar/auth \
  -H "apikey: [ANON_KEY]"
```

Deve retornar status `204 No Content` ou `200 OK`.

## Método 3: Verificar Variáveis de Ambiente

1. No Supabase Dashboard: **Edge Functions** → **google-calendar** → **Settings** → **Secrets**
2. Verifique se estas variáveis estão configuradas:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `FRONTEND_URL` ⚠️ **IMPORTANTE para redirecionamento**
   - `SUPABASE_URL` (geralmente configurado automaticamente)
   - `SUPABASE_ANON_KEY` (geralmente configurado automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` (recomendado)

## Método 4: Testar no Frontend

1. Inicie o frontend: `cd frontend && npm run dev`
2. Acesse: `http://localhost:5173/settings`
3. Abra o Console do Navegador (F12)
4. Clique em "Conectar Google Calendar"
5. Verifique se não há erros no console
6. Verifique os logs da Edge Function no Supabase Dashboard

## Verificar Versão do Código

Para garantir que a versão mais recente está deployada:

1. Verifique a data do último deploy no Supabase Dashboard
2. Compare com a data da última modificação do arquivo `supabase/functions/google-calendar/index.ts`
3. Se o código foi modificado após o último deploy, faça deploy novamente:

```bash
cd backend
supabase functions deploy google-calendar
```

## Verificar Redirecionamento

Após configurar `FRONTEND_URL`:

1. Faça o fluxo de autenticação completo
2. Após autorizar no Google, você deve ser redirecionado para `/settings` no seu frontend
3. Se ainda aparecer a página HTML do Supabase, verifique:
   - Se `FRONTEND_URL` está configurada corretamente
   - Se a URL está sem barra no final
   - Se inclui o protocolo (`http://` ou `https://`)
   - Aguarde alguns segundos após salvar a variável

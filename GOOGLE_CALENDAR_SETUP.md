# Configuração do Google Calendar API

Este documento descreve como configurar a integração com Google Calendar API.

## Pré-requisitos

1. Conta Google
2. Acesso ao Google Cloud Console
3. Projeto Supabase configurado

## Passo 1: Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o ID do projeto

## Passo 2: Habilitar Google Calendar API

1. No Google Cloud Console, vá em **APIs & Services** > **Library**
2. Procure por "Google Calendar API"
3. Clique em **Enable** para habilitar a API

## Passo 3: Criar Credenciais OAuth 2.0

1. Vá em **APIs & Services** > **Credentials**
2. Clique em **Create Credentials** > **OAuth client ID**
3. Se solicitado, configure a tela de consentimento OAuth:
   - Tipo: **External**
   - Nome do app: "Finanças Pessoais"
   - Email de suporte: seu email
   - Adicione seu email como testador
4. Configure o OAuth client:
   - Application type: **Web application**
   - Name: "Finanças Pessoais Web Client"
   - Authorized redirect URIs: 
     ```
     https://[SEU_PROJETO_SUPABASE].supabase.co/functions/v1/google-calendar/callback
     ```
     Substitua `[SEU_PROJETO_SUPABASE]` pelo ID do seu projeto Supabase
     **Exemplo para o projeto atual:**
     ```
     https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback
     ```
     **IMPORTANTE:** 
     - A URL deve ser EXATAMENTE igual, sem trailing slash (`/`) no final
     - Deve usar HTTPS (não HTTP)
     - Deve incluir `/functions/v1/google-calendar/callback` completo
     **Nota:** A Edge Function retornará uma página HTML que redireciona para o deep link do app.
5. Clique em **Create**
6. Anote o **Client ID** e **Client Secret**

## Passo 4: Configurar Variáveis de Ambiente no Supabase

1. Acesse o dashboard do Supabase
2. Vá em **Project Settings** > **Edge Functions** > **Secrets**
3. Adicione as seguintes variáveis:

```
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=https://[SEU_PROJETO_SUPABASE].supabase.co/functions/v1/google-calendar/callback
```

Substitua `[SEU_PROJETO_SUPABASE]` pelo ID do seu projeto Supabase.

**Exemplo para o projeto atual:**
```
GOOGLE_CLIENT_ID=413591457260-qioq05tuo0eo70m3jojpt30ukgds638k.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback
```

**IMPORTANTE:** A `GOOGLE_REDIRECT_URI` deve ser EXATAMENTE igual à URL configurada no Google Cloud Console (sem trailing slash, com HTTPS).

## Passo 5: Executar Migration no Supabase

1. Acesse o SQL Editor no Supabase
2. Execute o arquivo `supabase/migrations/20241203000000_create_google_tokens.sql`
3. Verifique se a tabela `google_tokens` foi criada

## Passo 6: Deploy da Edge Function

**Importante:** Execute todos os comandos abaixo no diretório raiz do projeto (`financas-pessoais-mobile`), onde está localizado o diretório `supabase/`.

1. Abra o terminal/PowerShell e navegue até o diretório do projeto:
   ```bash
   cd financas-pessoais-mobile
   ```

2. Instale o Supabase CLI (se ainda não tiver):
   ```bash
   npm install -g supabase
   ```

3. Faça login no Supabase:
   ```bash
   supabase login
   ```
   Isso abrirá o navegador para você fazer login na sua conta Supabase.

4. Link seu projeto:
   ```bash
   supabase link --project-ref [SEU_PROJETO_REF]
   ```
   **Onde encontrar o PROJECT_REF:**
   - Acesse o dashboard do Supabase: https://app.supabase.com
   - Selecione seu projeto
   - Vá em **Settings** > **General**
   - O **Reference ID** é o valor que você precisa usar
   - **Exemplo baseado no seu projeto:** `iqcupswgotsuncysagmj` (extraído da URL do Supabase no `app.json`)
   - **Comando completo de exemplo:**
     ```bash
     supabase link --project-ref iqcupswgotsuncysagmj
     ```

5. Faça deploy da Edge Function:
   ```bash
   supabase functions deploy google-calendar
   ```
   Este comando irá fazer upload da função localizada em `supabase/functions/google-calendar/index.ts` para o Supabase.

6. **Ver logs da Edge Function no terminal:**
   ```bash
   npx supabase functions logs google-calendar --follow
   ```
   Este comando mostra os logs em tempo real. Mantenha este terminal aberto para ver os logs enquanto testa o app.

## Passo 7: Configurar Deep Link no App (Opcional)

Para melhor experiência no mobile, configure deep links no `app.json`:

```json
{
  "expo": {
    "scheme": "financas-pessoais"
  }
}
```

## Testando a Integração

1. Abra o app
2. Crie uma nova transação com status "A receber" ou "A pagar"
3. O app deve solicitar autorização do Google Calendar
4. Após autorizar, o evento deve ser criado automaticamente no Google Calendar

## Troubleshooting

### Erro: "GOOGLE_AUTH_REQUIRED"
- Verifique se as variáveis de ambiente estão configuradas corretamente no Supabase
- Verifique se a Edge Function foi deployada com sucesso
- Verifique os logs da Edge Function no Supabase

### Erro: "Token não encontrado"
- O usuário precisa autorizar o Google Calendar primeiro
- Verifique se a tabela `google_tokens` existe e tem dados

### Erro 401: "Missing authorization header" no callback
Este erro ocorre quando o Supabase bloqueia a requisição do Google antes de chegar na Edge Function.

**Solução implementada:** 
- A Edge Function processa o callback GET ANTES de qualquer verificação de autenticação
- Usa o parâmetro `state` do OAuth para identificar o usuário sem precisar de autenticação
- Processa o código e salva os tokens usando service role key
- Retorna uma página HTML com o código na URL para o WebBrowser capturar

**Se o erro persistir (especialmente no Expo Go):**

O problema pode ser que o **gateway do Supabase está bloqueando a requisição antes de chegar na função**. Isso é uma limitação conhecida do Supabase Edge Functions.

**Soluções possíveis:**

1. **Verificar logs da Edge Function:**
   - Acesse: https://supabase.com/dashboard/project/iqcupswgotsuncysagmj/functions/google-calendar/logs
   - Os logs agora incluem informações detalhadas:
     - `=== CALLBACK GET RECEBIDO ===` - Quando o callback é recebido
     - `Code recebido: SIM/NÃO` - Se o código foi recebido
     - `State recebido: SIM/NÃO` - Se o state foi recebido
     - `Processando código com state...` - Quando começa a processar
     - `Tokens salvos com sucesso` - Quando os tokens são salvos
   - Se você ver "EarlyDrop" ou "shutdown", significa que o gateway está bloqueando
   - **Dica:** Mantenha a página de logs aberta enquanto testa para ver os logs em tempo real

2. **Verificar se a função foi deployada:**
   ```bash
   supabase functions deploy google-calendar
   ```

3. **Verificar configurações do Supabase:**
   - Algumas configurações de segurança do Supabase podem estar bloqueando requisições sem autenticação
   - Verifique se há políticas de segurança que precisam ser ajustadas

4. **Solução alternativa para Expo Go:**
   - O Expo Go tem limitações com OAuth
   - Considere fazer build do app para testar em ambiente de produção
   - Apps buildados têm melhor suporte a deep links e OAuth

5. **Verificar se o código está sendo processado:**
   - Mesmo com erro 401, o código pode estar sendo processado em background
   - Verifique se os tokens foram salvos na tabela `google_tokens`
   - Tente verificar a autenticação novamente no app

### Callback não está sendo chamado (GET /callback não aparece nos logs)

**Sintoma:** Os logs da Edge Function mostram requisições para `/auth` e `/check-auth`, mas NÃO mostram nenhuma requisição para `/callback` após autorizar no Google.

**Causa Provável:** A URL de redirecionamento no Google Cloud Console não está configurada corretamente ou não corresponde exatamente à URL usada.

**Solução - Checklist de Verificação:**

1. **Acesse o Google Cloud Console:**
   - Vá para: https://console.cloud.google.com/
   - Selecione seu projeto
   - Navegue até **APIs & Services** > **Credentials**

2. **Encontre seu OAuth 2.0 Client ID:**
   - Procure pelo client ID que você está usando (ex: `413591457260-qioq05tuo0eo70m3jojpt30ukgds638k.apps.googleusercontent.com`)
   - Clique no nome do client para editar

3. **Verifique a URL de redirecionamento:**
   - Na seção **Authorized redirect URIs**, verifique se existe EXATAMENTE esta URL:
     ```
     https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback
     ```
   - **IMPORTANTE:** A URL deve ser EXATAMENTE igual, sem diferenças:
     - ✅ Correto: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback`
     - ❌ Errado: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback/` (com barra no final)
     - ❌ Errado: `http://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback` (sem HTTPS)
     - ❌ Errado: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar` (sem /callback)

4. **Se a URL não estiver correta:**
   - Clique em **+ ADD URI**
   - Adicione a URL correta: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback`
   - Clique em **SAVE**
   - **Aguarde alguns minutos** para as mudanças serem propagadas

5. **Verifique também a variável de ambiente no Supabase:**
   - Acesse o dashboard do Supabase
   - Vá em **Project Settings** > **Edge Functions** > **Secrets**
   - Verifique se `GOOGLE_REDIRECT_URI` está configurada como:
     ```
     https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback
     ```
   - Deve ser EXATAMENTE igual à URL no Google Cloud Console

6. **Teste a acessibilidade pública do endpoint:**
   - Abra um navegador e acesse:
     ```
     https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/test-public
     ```
   - Se você ver uma resposta JSON com `"public": true`, significa que o arquivo `supabase.functions.config.json` está funcionando
   - Se você receber um erro 401, o arquivo de configuração pode não estar sendo aplicado

7. **Teste novamente:**
   - Após corrigir a URL, aguarde 2-3 minutos
   - Tente autorizar novamente no app
   - Verifique os logs da Edge Function
   - Agora você deve ver `=== CALLBACK GET RECEBIDO ===` nos logs

**Verificação Rápida:**
- URL no Google Cloud Console: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback`
- URL na variável `GOOGLE_REDIRECT_URI` no Supabase: `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/google-calendar/callback`
- URL na URL de autorização gerada (verifique nos logs): deve conter `redirect_uri=https%3A%2F%2Fiqcupswgotsuncysagmj.supabase.co%2Ffunctions%2Fv1%2Fgoogle-calendar%2Fcallback`

**Se ainda não funcionar após verificar tudo acima:**

1. **Verifique se você completou a autorização no Google:**
   - Certifique-se de clicar em "Continuar" ou "Permitir" na tela de autorização do Google
   - Não feche a janela antes de completar a autorização
   - Verifique os logs do app para ver se há mensagem "Usuário cancelou a autorização"

2. **Verifique se o app está publicado no Google Cloud Console:**
   - Acesse: https://console.cloud.google.com/
   - Vá em **APIs & Services** > **OAuth consent screen**
   - Verifique o status do app:
     - Se estiver em "Testing", você precisa adicionar seu email como testador
     - Se quiser que qualquer usuário possa usar, clique em "PUBLISH APP"
   - **Para adicionar testadores:**
     - Na seção "Test users", clique em "+ ADD USERS"
     - Adicione o email que você usa para fazer login no Google
     - Clique em "ADD"
   - **Importante:** Após adicionar testadores ou publicar, aguarde alguns minutos para as mudanças serem propagadas

3. **Verifique os logs do app:**
   - Abra o console do app (React Native Debugger ou Metro logs)
   - Procure por mensagens como:
     - `=== INICIANDO FLUXO DE AUTENTICAÇÃO GOOGLE ===`
     - `=== ABRINDO WEBBROWSER ===`
     - `=== WEBBROWSER RETORNOU ===`
     - `Tipo do resultado:` (deve ser 'success' se autorizou, 'cancel' se cancelou)
   - Se ver "Usuário cancelou a autorização", você precisa completar a autorização no Google

4. **Verifique os logs da Edge Function:**
   - Acesse: https://supabase.com/dashboard/project/iqcupswgotsuncysagmj/functions/google-calendar/logs
   - Procure por `=== CALLBACK GET RECEBIDO ===` ou `=== CALLBACK DETECTADO NO LOG INICIAL ===`
   - Se não aparecer nenhuma requisição para `/callback`, significa que o Google não está redirecionando

5. **Aguarde propagação:**
   - Mudanças no Google Cloud Console podem levar até 10 minutos para serem propagadas
   - Após fazer alterações, aguarde alguns minutos antes de testar novamente

### Problemas com Expo Go
O Expo Go tem limitações com deep links e OAuth. Se você estiver testando no Expo Go e encontrar problemas:

1. **O WebBrowser pode capturar a URL da Edge Function diretamente** - O código está na query string da URL
2. **Verifique os logs do console** - O app tenta extrair o código tanto da URL HTTP quanto do deep link
3. **Para melhor compatibilidade, considere fazer build do app** - Apps buildados têm melhor suporte a deep links e OAuth
4. **Se o problema persistir no Expo Go**, você pode:
   - Verificar se a URL capturada pelo WebBrowser contém o código
   - Tentar copiar o código manualmente da URL e processá-lo
   - Fazer build do app para testar em ambiente de produção

### Eventos não são criados
- Verifique os logs da Edge Function
- Verifique se o token não expirou (a função deve fazer refresh automaticamente)
- Verifique se a Google Calendar API está habilitada no Google Cloud Console

## Segurança

- Nunca exponha o `GOOGLE_CLIENT_SECRET` no código do frontend
- Use sempre a Edge Function como proxy para autenticação
- Os tokens são armazenados de forma segura no Supabase com RLS habilitado

juikolp
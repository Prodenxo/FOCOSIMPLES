# Guia de Deploy das Edge Functions

Este guia explica como fazer deploy das Edge Functions do Supabase para o seu projeto.

## Pré-requisitos

1. **Supabase CLI instalado**
   ```bash
   npm install -g supabase
   ```
   
   Ou baixe de: https://github.com/supabase/cli/releases

2. **Login no Supabase**
   ```bash
   supabase login
   ```

3. **Project Ref do seu projeto**
   - Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT_REF]
   - Ou vá em: Settings > General > Reference ID

## Deploy Automático

### Windows
```cmd
cd backend
deploy-functions.bat [SEU_PROJECT_REF]
```

### Linux/Mac
```bash
cd backend
chmod +x deploy-functions.sh
./deploy-functions.sh [SEU_PROJECT_REF]
```

## Deploy Manual

Se preferir fazer deploy manualmente:

```bash
# 0. Entrar na pasta canônica do Supabase
cd supabase

# 1. Linkar projeto
supabase link --project-ref [SEU_PROJECT_REF]

# 2. Deploy de cada função
supabase functions deploy auth
supabase functions deploy transactions
supabase functions deploy categories
supabase functions deploy users
supabase functions deploy google-calendar
```

## Configuração de Variáveis de Ambiente

Após o deploy, configure as variáveis de ambiente no painel do Supabase:

1. Acesse: https://supabase.com/dashboard/project/[PROJECT_REF]/functions
2. Clique na função que deseja configurar
3. Vá em **Settings** > **Secrets**
4. Adicione as variáveis necessárias

### Variáveis Obrigatórias (todas as funções)

Estas variáveis são configuradas automaticamente pelo Supabase, mas verifique se estão presentes:

- `SUPABASE_URL` - URL do seu projeto Supabase
- `SUPABASE_ANON_KEY` - Chave pública do Supabase

### Variáveis Recomendadas

**Para a função `auth`:**
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (mais segura para operações de autenticação)
  - Encontre em: Settings > API > service_role key

**Para a função `google-calendar`:**
- `GOOGLE_CLIENT_ID` - ID do cliente OAuth do Google
- `GOOGLE_CLIENT_SECRET` - Secret do cliente OAuth do Google
- `GOOGLE_REDIRECT_URI` - URI de redirecionamento (ex: `https://[PROJECT_REF].supabase.co/functions/v1/google-calendar/callback`)
- `FRONTEND_URL` - URL do frontend para redirecionamento após autenticação (ex: `http://localhost:5173` para desenvolvimento ou `https://seu-app.com` para produção)

## Verificação do Deploy

### 1. Verificar no Painel do Supabase

1. Acesse: https://supabase.com/dashboard/project/[PROJECT_REF]/functions
2. Verifique se todas as funções aparecem na lista
3. Clique em cada função para ver os logs e status

### 2. Testar Conectividade

Use o script de teste:

```bash
cd backend
deno run --allow-net test-edge-function.ts [NOME_DA_FUNCAO]
```

Ou teste manualmente via curl:

```bash
curl -X OPTIONS \
  https://[SEU_PROJECT_REF].supabase.co/functions/v1/auth \
  -H "apikey: [SUA_ANON_KEY]"
```

Deve retornar status `204 No Content` para requisições OPTIONS.

### 3. Testar no Frontend

1. Inicie o frontend: `npm run dev`
2. Tente fazer login
3. Verifique o console do navegador para erros
4. Se houver erro de CORS, verifique:
   - Se a função está deployada
   - Se as variáveis de ambiente estão configuradas
   - Se o project-ref está correto

## Troubleshooting

### Erro: "Function not found" (404)

**Causa**: A função não foi deployada ou o nome está incorreto.

**Solução**:
1. Verifique se a função está listada no painel do Supabase
2. Faça deploy novamente: `supabase functions deploy [nome-da-funcao]`
3. Verifique se o nome da função no código corresponde ao nome do diretório

### Erro: "CORS policy" no navegador

**Causa**: A função não está respondendo corretamente ao preflight (OPTIONS).

**Solução**:
1. Verifique se a função está deployada
2. Verifique os logs da função no painel do Supabase
3. Certifique-se de que o código da função trata requisições OPTIONS corretamente
4. Faça um novo deploy após corrigir o código

### Erro: "Configuração do servidor incompleta" (500)

**Causa**: Variáveis de ambiente não configuradas.

**Solução**:
1. Acesse o painel do Supabase
2. Vá em Settings > Edge Functions > [Nome da Função] > Secrets
3. Adicione `SUPABASE_URL` e `SUPABASE_ANON_KEY` se não estiverem presentes
4. Aguarde alguns segundos para as variáveis serem aplicadas

### Erro: "Não autenticado" (401)

**Causa**: Token de autenticação inválido ou ausente.

**Solução**:
1. Verifique se o token está sendo enviado no header `Authorization`
2. Verifique se o token não expirou
3. Faça login novamente no frontend

### Logs não aparecem

**Causa**: Logs podem ter um delay ou a função não está sendo chamada.

**Solução**:
1. Aguarde alguns segundos e atualize a página de logs
2. Verifique se está olhando os logs da função correta
3. Tente fazer uma requisição de teste para gerar logs

## Estrutura das Edge Functions

```
supabase/functions/
├── auth/
│   ├── index.ts          # Função de autenticação
│   └── deno.json         # Configuração Deno
├── transactions/
│   ├── index.ts          # CRUD de transações
│   └── deno.json
├── categories/
│   ├── index.ts          # CRUD de categorias
│   └── deno.json
├── users/
│   ├── index.ts          # Operações de usuário
│   └── deno.json
└── google-calendar/
    ├── index.ts          # Integração Google Calendar
    └── deno.json
```

## URLs das Edge Functions

Após o deploy, as funções estarão disponíveis em:

```
https://[PROJECT_REF].supabase.co/functions/v1/[nome-da-funcao]
```

Exemplos:
- `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/auth`
- `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/transactions`
- `https://iqcupswgotsuncysagmj.supabase.co/functions/v1/categories`

## Próximos Passos

Após fazer o deploy:

1. ✅ Configure as variáveis de ambiente
2. ✅ Teste a conectividade
3. ✅ Teste no frontend
4. ✅ Verifique os logs se houver problemas
5. ✅ Configure CORS se necessário (geralmente já está configurado)

## Recursos Adicionais

- [Documentação Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Troubleshooting Edge Functions](https://supabase.com/docs/guides/functions/troubleshooting)

# Verificar Configuração no Dashboard do Supabase

## ⚠️ IMPORTANTE: Este passo é CRÍTICO para resolver o erro 401

O gateway do Supabase pode estar bloqueando requisições mesmo com `config.toml` configurado. É necessário verificar e ajustar manualmente no dashboard.

## Passo a Passo

### 1. Acessar o Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto: `iqcupswgotsuncysagmj`
3. Vá em **Edge Functions** (menu lateral)

### 2. Encontrar a Função google-calendar

1. Na lista de Edge Functions, encontre `google-calendar`
2. Clique na função para abrir os detalhes

### 3. Verificar Configuração de Autenticação

1. Procure por uma seção chamada:
   - **"Settings"** ou **"Configuration"**
   - **"Verify JWT"** ou **"Enforce JWT Verification"**
   - **"Authentication"** ou **"Auth"**

2. Verifique se há um **toggle** ou **switch** que controla verificação JWT

3. **IMPORTANTE**: O toggle deve estar **DESLIGADO** (OFF) para permitir requisições sem autenticação

### 4. Se o Toggle Estiver Ligado

1. **Desligue** o toggle "Verify JWT" ou "Enforce JWT Verification"
2. Clique em **"Save"** ou **"Update"**
3. Aguarde alguns segundos para a configuração ser aplicada

### 5. Verificar Outras Configurações

Procure também por:
- **"Public Access"** ou **"Public Function"** - deve estar **LIGADO**
- **"Require Authentication"** - deve estar **DESLIGADO**
- **"Auth Required"** - deve estar **DESLIGADO**

## ⚠️ Problema Conhecido

Segundo a documentação do Supabase, há um bug conhecido onde:
- O toggle pode não refletir o `config.toml` após atualizações
- Pode ser necessário desligar manualmente no dashboard
- A configuração pode não ser aplicada imediatamente

## ✅ Após Configurar

1. Teste novamente o fluxo de autenticação do Google Calendar
2. Verifique os logs da Edge Function
3. Se o erro 401 persistir, tente fazer um novo deploy com `--no-verify-jwt`

## 📝 Nota

Se você não encontrar essas opções no dashboard, pode ser que:
- A interface mudou (verifique a documentação mais recente)
- O projeto usa uma versão diferente do Supabase
- A configuração está em outro lugar

Nesse caso, tente fazer deploy com a flag explícita: `supabase functions deploy google-calendar --no-verify-jwt`

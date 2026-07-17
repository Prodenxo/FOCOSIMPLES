# Migração do Banco de Dados Antigo para user_id

## Visão Geral

Este documento descreve como aplicar a migração do banco de dados antigo (que usa `user_phone`) para usar `user_id` como identificador de usuário em todas as tabelas.

## Arquivo de Migração

O script de migração está localizado em:
```
backend/supabase/migrations/20241203000007_migrate_old_db_to_user_id.sql
```

## O que o Script Faz

O script de migração é **idempotente** e realiza as seguintes operações:

### 1. Tabela `google_tokens`
- Adiciona coluna `user_id` se não existir
- Migra dados de `user_phone` para `user_id` através de `auth.users.raw_user_meta_data->>'phone'`
- Cria índice em `user_id`
- Atualiza constraint UNIQUE para `user_id`
- Atualiza políticas RLS para usar `auth.uid() = user_id`
- Mantém `user_phone` temporariamente para compatibilidade

### 2. Tabela `lancamentos`
- Cria tabela se não existir
- Adiciona coluna `user_id` (nullable) se não existir
- Se existir `user_phone`, migra dados para `user_id`
- Permite `user_id IS NULL` para transações globais
- Cria índices necessários
- Atualiza políticas RLS:
  - SELECT: usuários veem suas transações + transações globais
  - INSERT/UPDATE/DELETE: apenas próprias transações

### 3. Tabela `categorias`
- Cria tabela se não existir
- Adiciona coluna `user_id` (nullable) se não existir
- Se existir `user_phone`, migra dados para `user_id`
- Permite `user_id IS NULL` para categorias globais
- Cria índices necessários (incluindo índice composto `(user_id, tipo)`)
- Atualiza políticas RLS:
  - SELECT: usuários veem suas categorias + categorias globais
  - INSERT/UPDATE/DELETE: apenas próprias categorias

### 4. Funções e Triggers
- Cria/atualiza função `update_updated_at_column()`
- Cria/atualiza trigger `update_google_tokens_updated_at`

### 5. Sequências
- Corrige sequência da tabela `categorias` se necessário

## Como Aplicar a Migração

### Opção 1: Usando Supabase CLI

```bash
# Navegar até o diretório do backend
cd backend

# Aplicar a migração
supabase db push

# Ou aplicar migrações específicas
supabase migration up
```

### Opção 2: Executar SQL Diretamente no Banco

1. Conecte-se ao banco de dados PostgreSQL:
   ```bash
   psql "postgresql://postgres:.fH4UxDAseq$qy!@db.iqcupswgotsuncysagmj.supabase.co:5432/postgres"
   ```

2. Execute o script de migração:
   ```sql
   \i backend/supabase/migrations/20241203000007_migrate_old_db_to_user_id.sql
   ```

   Ou copie e cole o conteúdo do arquivo SQL diretamente no cliente PostgreSQL.

### Opção 3: Usando o Dashboard do Supabase

1. Acesse o dashboard do Supabase: https://app.supabase.com
2. Vá em **SQL Editor**
3. Copie o conteúdo do arquivo de migração
4. Cole e execute o script

## Verificação Pós-Migração

Após executar a migração, verifique:

### 1. Verificar Estrutura das Tabelas

```sql
-- Verificar colunas da tabela google_tokens
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'google_tokens';

-- Verificar colunas da tabela lancamentos
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lancamentos';

-- Verificar colunas da tabela categorias
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'categorias';
```

### 2. Verificar Migração de Dados

```sql
-- Verificar se os dados foram migrados corretamente em google_tokens
SELECT 
  COUNT(*) as total,
  COUNT(user_id) as com_user_id,
  COUNT(user_phone) as com_user_phone
FROM google_tokens;

-- Verificar se os dados foram migrados corretamente em lancamentos
SELECT 
  COUNT(*) as total,
  COUNT(user_id) as com_user_id
FROM lancamentos;

-- Verificar se os dados foram migrados corretamente em categorias
SELECT 
  COUNT(*) as total,
  COUNT(user_id) as com_user_id
FROM categorias;
```

### 3. Verificar Políticas RLS

```sql
-- Verificar políticas da tabela google_tokens
SELECT * FROM pg_policies WHERE tablename = 'google_tokens';

-- Verificar políticas da tabela lancamentos
SELECT * FROM pg_policies WHERE tablename = 'lancamentos';

-- Verificar políticas da tabela categorias
SELECT * FROM pg_policies WHERE tablename = 'categorias';
```

### 4. Verificar Índices

```sql
-- Verificar índices criados
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('google_tokens', 'lancamentos', 'categorias')
ORDER BY tablename, indexname;
```

## Características do Script

- **Idempotente**: Pode ser executado múltiplas vezes sem problemas
- **Preserva Dados**: Todos os dados existentes são preservados
- **Compatibilidade**: Mantém `user_phone` temporariamente
- **Segurança**: Atualiza políticas RLS para usar `auth.uid()`
- **Performance**: Cria índices necessários para otimização

## Notas Importantes

1. **Backup**: Sempre faça backup do banco de dados antes de executar migrações
2. **Teste**: Teste a migração em um ambiente de desenvolvimento primeiro
3. **user_phone**: A coluna `user_phone` é mantida temporariamente. Pode ser removida em uma migração futura após confirmação
4. **Transações Globais**: Tanto `lancamentos` quanto `categorias` permitem `user_id IS NULL` para itens globais
5. **Mapeamento**: A migração mapeia `user_phone` → `user_id` através de `auth.users.raw_user_meta_data->>'phone'`

## Troubleshooting

### Erro: "relation does not exist"
- O script usa `CREATE TABLE IF NOT EXISTS`, então isso não deve acontecer
- Verifique se você está conectado ao banco correto

### Erro: "column already exists"
- O script usa `ADD COLUMN IF NOT EXISTS`, então isso não deve acontecer
- Se ocorrer, o script é idempotente e pode ser executado novamente

### Dados não migrados
- Verifique se `auth.users` tem os dados de `raw_user_meta_data->>'phone'` corretos
- Execute manualmente a query de migração se necessário:
  ```sql
  UPDATE google_tokens gt
  SET user_id = u.id
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'phone' = gt.user_phone
    AND gt.user_id IS NULL;
  ```

## Próximos Passos

Após confirmar que a migração foi bem-sucedida:

1. Testar a aplicação para garantir que tudo funciona
2. Remover referências a `user_phone` no código (se houver)
3. Criar uma migração futura para remover a coluna `user_phone` (opcional)


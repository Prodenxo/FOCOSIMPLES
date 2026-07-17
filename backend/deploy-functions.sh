#!/bin/bash
# Script de deploy para Edge Functions do Supabase (Linux/Mac)
# Uso: ./deploy-functions.sh [project-ref]

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_WORKDIR="$SCRIPT_DIR/../supabase"

if [ ! -d "$SUPABASE_WORKDIR" ]; then
    echo "[ERRO] Diretorio canonico do Supabase nao encontrado: $SUPABASE_WORKDIR"
    exit 1
fi

echo "========================================"
echo "Deploy de Edge Functions - Supabase"
echo "========================================"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "[ERRO] Supabase CLI não está instalado!"
    echo ""
    echo "Instale com: npm install -g supabase"
    echo "Ou baixe de: https://github.com/supabase/cli/releases"
    exit 1
fi

echo "[OK] Supabase CLI encontrado"
echo ""

# Verificar se está logado
if ! supabase --workdir "$SUPABASE_WORKDIR" projects list &> /dev/null; then
    echo "[AVISO] Você precisa fazer login no Supabase"
    echo "Execute: supabase login"
    echo ""
    exit 1
fi

echo "[OK] Autenticado no Supabase"
echo ""

# Obter project-ref se fornecido
PROJECT_REF=$1
if [ -z "$PROJECT_REF" ]; then
    echo "Por favor, informe o project-ref do seu projeto Supabase"
    echo "Exemplo: ./deploy-functions.sh iqcupswgotsuncysagmj"
    echo ""
    echo "Você pode encontrar o project-ref em:"
    echo "- URL do projeto: https://supabase.com/dashboard/project/[PROJECT_REF]"
    echo "- Settings > General > Reference ID"
    echo ""
    read -p "Project Ref: " PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
    echo "[ERRO] Project-ref não fornecido"
    exit 1
fi

echo ""
echo "Linkando projeto: $PROJECT_REF"
supabase --workdir "$SUPABASE_WORKDIR" link --project-ref "$PROJECT_REF"
if [ $? -ne 0 ]; then
    echo "[ERRO] Falha ao linkar projeto"
    exit 1
fi

echo ""
echo "========================================"
echo "Fazendo deploy das Edge Functions..."
echo "========================================"
echo ""

# Lista de funções para deploy
FUNCTIONS=("auth" "transactions" "categories" "users" "google-calendar")

for func in "${FUNCTIONS[@]}"; do
    echo ""
    echo "[DEPLOY] $func"
    echo "----------------------------------------"
    if supabase --workdir "$SUPABASE_WORKDIR" functions deploy "$func"; then
        echo "[OK] $func deployado com sucesso"
    else
        echo "[ERRO] Falha ao fazer deploy de $func"
    fi
done

echo ""
echo "========================================"
echo "Deploy concluído!"
echo "========================================"
echo ""
echo "IMPORTANTE: Configure as variáveis de ambiente no painel do Supabase:"
echo "- Settings > Edge Functions > [Nome da Função] > Secrets"
echo ""
echo "Variáveis necessárias:"
echo "- SUPABASE_URL (já configurado automaticamente)"
echo "- SUPABASE_ANON_KEY (já configurado automaticamente)"
echo "- SUPABASE_SERVICE_ROLE_KEY (recomendado para auth)"
echo "- GOOGLE_CLIENT_ID (apenas para google-calendar)"
echo "- GOOGLE_CLIENT_SECRET (apenas para google-calendar)"
echo "- GOOGLE_REDIRECT_URI (apenas para google-calendar)"
echo "- FRONTEND_URL (apenas para google-calendar - ex: http://localhost:5173)"
echo ""

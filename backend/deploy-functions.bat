@echo off
REM Script de deploy para Edge Functions do Supabase (Windows)
REM Uso: deploy-functions.bat [project-ref]

echo ========================================
echo Deploy de Edge Functions - Supabase
echo ========================================
echo.

REM Verificar se Supabase CLI está instalado
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Supabase CLI nao esta instalado!
    echo.
    echo Instale com: npm install -g supabase
    echo Ou baixe de: https://github.com/supabase/cli/releases
    exit /b 1
)

echo [OK] Supabase CLI encontrado
echo.

set SUPABASE_WORKDIR=%~dp0..\supabase
if not exist "%SUPABASE_WORKDIR%" (
    echo [ERRO] Diretorio canonico do Supabase nao encontrado: %SUPABASE_WORKDIR%
    exit /b 1
)

REM Verificar se está logado
supabase --workdir "%SUPABASE_WORKDIR%" projects list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Voce precisa fazer login no Supabase
    echo Execute: supabase login
    echo.
    pause
    exit /b 1
)

echo [OK] Autenticado no Supabase
echo.

REM Obter project-ref se fornecido
set PROJECT_REF=%1
if "%PROJECT_REF%"=="" (
    echo Por favor, informe o project-ref do seu projeto Supabase
    echo Exemplo: deploy-functions.bat iqcupswgotsuncysagmj
    echo.
    echo Voce pode encontrar o project-ref em:
    echo - URL do projeto: https://supabase.com/dashboard/project/[PROJECT_REF]
    echo - Settings ^> General ^> Reference ID
    echo.
    set /p PROJECT_REF="Project Ref: "
)

if "%PROJECT_REF%"=="" (
    echo [ERRO] Project-ref nao fornecido
    exit /b 1
)

echo.
echo Linkando projeto: %PROJECT_REF%
supabase --workdir "%SUPABASE_WORKDIR%" link --project-ref %PROJECT_REF%
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao linkar projeto
    exit /b 1
)

echo.
echo ========================================
echo Fazendo deploy das Edge Functions...
echo ========================================
echo.

REM Lista de funções para deploy
set FUNCTIONS=auth transactions categories users google-calendar

for %%f in (%FUNCTIONS%) do (
    echo.
    echo [DEPLOY] %%f
    echo ----------------------------------------
    supabase --workdir "%SUPABASE_WORKDIR%" functions deploy %%f
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao fazer deploy de %%f
    ) else (
        echo [OK] %%f deployado com sucesso
    )
)

echo.
echo ========================================
echo Deploy concluido!
echo ========================================
echo.
echo IMPORTANTE: Configure as variaveis de ambiente no painel do Supabase:
echo - Settings ^> Edge Functions ^> [Nome da Funcao] ^> Secrets
echo.
echo Variaveis necessarias:
echo - SUPABASE_URL (ja configurado automaticamente)
echo - SUPABASE_ANON_KEY (ja configurado automaticamente)
echo - SUPABASE_SERVICE_ROLE_KEY (recomendado para auth)
echo - GOOGLE_CLIENT_ID (apenas para google-calendar)
echo - GOOGLE_CLIENT_SECRET (apenas para google-calendar)
echo - GOOGLE_REDIRECT_URI (apenas para google-calendar)
echo - FRONTEND_URL (apenas para google-calendar - ex: http://localhost:5173)
echo.
pause

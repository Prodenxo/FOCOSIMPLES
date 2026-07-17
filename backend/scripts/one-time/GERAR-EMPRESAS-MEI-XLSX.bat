@echo off
chcp 65001 >nul
cd /d "%~dp0\..\.."

echo Gerando planilha de empresas MEI...
node scripts/one-time/export-empresas-mei-xlsx.mjs --output=scripts/one-time/exports/empresas-mei.xlsx
if errorlevel 1 (
  echo.
  echo Falhou. Confira o .env em Site/backend com SUPABASE_SERVICE_ROLE_KEY.
  pause
  exit /b 1
)

echo.
echo Pronto:
echo   %~dp0exports\empresas-mei.xlsx
echo.
start "" "%~dp0exports\empresas-mei.xlsx"
pause

# Executa os passos do plano "Vercel CLI conferir e corrigir" (backend).
# Pré-requisito: "npx vercel login" OU variável VERCEL_TOKEN (ou -Token no script).
# Uso: na pasta backend, .\scripts\vercel-conferir-e-corrigir.ps1
#      Com token: $env:VERCEL_TOKEN='seu-token'; .\scripts\vercel-conferir-e-corrigir.ps1
#      Ou: .\scripts\vercel-conferir-e-corrigir.ps1 -Token 'seu-token'

param([string]$Token)

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendDir

if ($Token) { $env:VERCEL_TOKEN = $Token }

$vercelCmd = @("vercel")
if ($Token) { $vercelCmd += "--token"; $vercelCmd += $Token }
elseif ($env:VERCEL_TOKEN) { $vercelCmd += "--token"; $vercelCmd += $env:VERCEL_TOKEN }

function Invoke-Vercel {
    param([string[]]$CmdArgs)
    process {
        if ($null -ne $_) { $_ | & npx @vercelCmd @CmdArgs } else { & npx @vercelCmd @CmdArgs }
    }
}

Write-Host "[1/6] Verificando login na Vercel..."
$whoami = Invoke-Vercel -CmdArgs @("whoami") 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Nao esta logado. Rode: npx vercel login" -ForegroundColor Red
    exit 1
}
Write-Host "Logado como: $whoami"

Write-Host "`n[2/6] Vinculando pasta ao projeto (se necessario)..."
if (-not (Test-Path ".vercel")) {
    Invoke-Vercel -CmdArgs @("link", "--yes")
    if ($LASTEXITCODE -ne 0) { Write-Host "Aviso: vercel link pode precisar ser executado interativamente (escolha o projeto backend)." -ForegroundColor Yellow }
} else {
    Write-Host "Projeto ja vinculado (.vercel existe)."
}

Write-Host "`n[3/6] Listando variaveis de ambiente..."
$envProd = Invoke-Vercel -CmdArgs @("env", "ls", "production") 2>&1 | Out-String
$envPreview = Invoke-Vercel -CmdArgs @("env", "ls", "preview") 2>&1 | Out-String
Write-Host "--- Production ---"
Write-Host $envProd
Write-Host "--- Preview ---"
Write-Host $envPreview

$corsValue = "https://meu-financeiro-frontend.vercel.app,https://meu-financeiro-frontend-teste.vercel.app"
$hasCors = ($envProd + $envPreview) -match "CORS_ORIGIN"

Write-Host "`n[4/6] CORS_ORIGIN..."
if (-not $hasCors) {
    Write-Host "Adicionando CORS_ORIGIN para production e preview..."
    $tmpFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmpFile, $corsValue)
    Get-Content $tmpFile -Raw | Invoke-Vercel -CmdArgs @("env", "add", "CORS_ORIGIN", "production") 2>&1
    Get-Content $tmpFile -Raw | Invoke-Vercel -CmdArgs @("env", "add", "CORS_ORIGIN", "preview") 2>&1
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    Write-Host "CORS_ORIGIN adicionado."
} else {
    Write-Host "CORS_ORIGIN ja existe. Nenhuma alteracao."
}

Write-Host "`n[5/6] Deploy de producao..."
Invoke-Vercel -CmdArgs @("--prod", "--yes")
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n[6/6] Teste OPTIONS (CORS)..."
$url = "https://meu-financeiro-backend-bk.vercel.app/api/auth/signin"
try {
    $r = Invoke-WebRequest -Uri $url -Method Options -Headers @{ "Origin" = "https://meu-financeiro-frontend-teste.vercel.app" } -UseBasicParsing -ErrorAction Stop
    $allowOrigin = $r.Headers["Access-Control-Allow-Origin"]
    if ($allowOrigin) {
        Write-Host "OK: Access-Control-Allow-Origin = $allowOrigin" -ForegroundColor Green
    } else {
        Write-Host "Aviso: header Access-Control-Allow-Origin nao encontrado na resposta." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Aviso: teste OPTIONS falhou: $_" -ForegroundColor Yellow
}

Write-Host "`nConcluido. Confira Root Directory no dashboard (Settings > General) se o CORS ainda falhar."

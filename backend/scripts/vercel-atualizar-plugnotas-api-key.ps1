# Atualiza a variavel PLUGNOTAS_API_KEY no projeto do backend na Vercel.
# Pre-requisito: "npx vercel login" OU VERCEL_TOKEN (ou -Token no script).
# Uso: na pasta backend, .\scripts\vercel-atualizar-plugnotas-api-key.ps1
#      Com token: $env:VERCEL_TOKEN='seu-token'; .\scripts\vercel-atualizar-plugnotas-api-key.ps1
#      Ou: .\scripts\vercel-atualizar-plugnotas-api-key.ps1 -Token 'seu-token'

param([string]$Token)

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $BackendDir

if ($Token) { $env:VERCEL_TOKEN = $Token }

$vercelCmd = @("vercel")
if ($Token) { $vercelCmd += "--token"; $vercelCmd += $Token }
elseif ($env:VERCEL_TOKEN) { $vercelCmd += "--token"; $vercelCmd += $env:VERCEL_TOKEN }

$defaultValue = "060c62f2f1f82e9effe47a5620bd9940"
$value = $defaultValue
$envPath = Join-Path $BackendDir ".env"
if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    if ($content -match '(?m)^\s*PLUGNOTAS_API_KEY\s*=\s*(.+?)\s*$') {
        $value = $matches[1].Trim()
    }
}

Write-Host "[1/4] Verificando login na Vercel..."
$whoami = & npx @vercelCmd whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Nao esta logado. Rode: npx vercel login" -ForegroundColor Red
    exit 1
}
Write-Host "Logado como: $whoami"

Write-Host "`n[2/4] Removendo PLUGNOTAS_API_KEY antiga (se existir)..."
& npx @vercelCmd env rm PLUGNOTAS_API_KEY production -y 2>&1
& npx @vercelCmd env rm PLUGNOTAS_API_KEY preview -y 2>&1
Write-Host "OK (ignorar erros se a variavel nao existia)."

Write-Host "`n[3/4] Adicionando PLUGNOTAS_API_KEY para production e preview..."
$tmpFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpFile, $value)
Get-Content $tmpFile -Raw | & npx @vercelCmd env add PLUGNOTAS_API_KEY production 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "Aviso: falha ao adicionar para production." -ForegroundColor Yellow }
Get-Content $tmpFile -Raw | & npx @vercelCmd env add PLUGNOTAS_API_KEY preview 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "Aviso: falha ao adicionar para preview." -ForegroundColor Yellow }
Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
Write-Host "PLUGNOTAS_API_KEY definida (valor lido de .env ou padrao)."

Write-Host "`n[4/4] Para aplicar, faca redeploy: npx vercel --prod (ou push para trigger)." -ForegroundColor Cyan

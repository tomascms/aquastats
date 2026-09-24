# Último passo: criar OAuth Web client no TEU projecto GCP (gen-lang-client-0997549665).
# Nunca uses o projecto diomika.

param(
  [string]$GcpProjectId = "gen-lang-client-0997549665",
  [string]$ClientId = ""
)

$redirects = @(
  "https://aquastats.net/api/v1/auth/google/callback",
  "https://www.aquastats.net/api/v1/auth/google/callback",
  "http://127.0.0.1:3000/api/v1/auth/google/callback"
)

Write-Host ""
Write-Host "=== Aquastats — Google OAuth (2 minutos) ===" -ForegroundColor Cyan
Write-Host "Projecto: $GcpProjectId"
Write-Host ""
Write-Host "1. OAuth consent screen (se ainda não existir):" -ForegroundColor Yellow
Write-Host "   https://console.cloud.google.com/auth/overview?project=$GcpProjectId"
Write-Host "   - App: Aquastats | Support email: contact@aquastats.net"
Write-Host "   - User type: External | Publishing: Testing (adiciona o teu email como test user)"
Write-Host ""
Write-Host "2. Criar Web client:" -ForegroundColor Yellow
Write-Host "   https://console.cloud.google.com/auth/clients/create?project=$GcpProjectId"
Write-Host "   - Application type: Web application"
Write-Host "   - Name: Aquastats Web"
Write-Host "   - Authorized redirect URIs:"
foreach ($uri in $redirects) { Write-Host "       $uri" }
Write-Host ""
Write-Host "3. Copia o Client ID e corre:" -ForegroundColor Yellow
Write-Host "   .\scripts\finish-google-oauth.ps1 -ClientId 'SEU_CLIENT_ID.apps.googleusercontent.com'"
Write-Host ""

if (-not $ClientId) {
  Start-Process "https://console.cloud.google.com/auth/clients/create?project=$GcpProjectId"
  exit 0
}

$envFile = Join-Path $PSScriptRoot "..\api\.env"
$content = Get-Content $envFile -Raw
if ($content -match "(?m)^GOOGLE_CLIENT_ID=.*$") {
  $content = $content -replace "(?m)^GOOGLE_CLIENT_ID=.*$", "GOOGLE_CLIENT_ID=$ClientId"
} else {
  $content += "`nGOOGLE_CLIENT_ID=$ClientId`n"
}
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host "GOOGLE_CLIENT_ID gravado em api/.env" -ForegroundColor Green
Write-Host "A republicar API no Cloud Run..." -ForegroundColor Cyan

$env:AQUASTATS_GCP_PROJECT = $GcpProjectId
Push-Location (Join-Path $PSScriptRoot "..")
& .\.deploy-venv\Scripts\python.exe .\.deploy-venv\cloudrun_redeploy_env.py
Pop-Location

Write-Host ""
Write-Host "Pronto. Testa: https://aquastats.net" -ForegroundColor Green

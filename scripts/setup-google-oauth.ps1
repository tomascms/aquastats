# Configura OAuth Google para Aquastats — usa SEMPRE conta/projecto dedicados ao Aquastats.
param(
  [Parameter(Mandatory = $true)]
  [string]$GcpProjectId,
  [Parameter(Mandatory = $true)]
  [string]$OAuthClientId
)

$redirects = @(
  "https://aquastats.net/api/v1/auth/google/callback",
  "https://www.aquastats.net/api/v1/auth/google/callback",
  "http://127.0.0.1:3000/api/v1/auth/google/callback"
)

$url = "https://console.cloud.google.com/auth/clients/$OAuthClientId?project=$GcpProjectId"

Write-Host ""
Write-Host "Projecto GCP: $GcpProjectId" -ForegroundColor Cyan
Write-Host "OAuth client:   $OAuthClientId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Adiciona estes Authorized redirect URIs:" -ForegroundColor Yellow
foreach ($uri in $redirects) { Write-Host "  - $uri" }
Write-Host ""
Write-Host "Abre: $url" -ForegroundColor Green
Start-Process $url

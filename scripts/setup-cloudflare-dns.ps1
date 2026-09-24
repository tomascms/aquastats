# CNAME api.aquastats.net → URL pública da tua API (Railway, Cloud Run próprio, etc.)
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiHost
)

$url = "https://dash.cloudflare.com/?to=/:account/aquastats.net/dns/records"

Write-Host ""
Write-Host "Cria um registo DNS CNAME:" -ForegroundColor Cyan
Write-Host "  Name:    api"
Write-Host "  Target:  $ApiHost"
Write-Host "  Proxy:   Proxied (laranja)"
Write-Host ""
Start-Process $url

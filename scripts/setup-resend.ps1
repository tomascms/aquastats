# Configura Resend + DNS Cloudflare para aquastats.net
# Uso: .\scripts\setup-resend.ps1 -ResendApiKey "re_xxxx"

param(
    [Parameter(Mandatory = $true)]
    [string]$ResendApiKey,
    [string]$Domain = "aquastats.net"
)

$ErrorActionPreference = "Stop"

Write-Host "A criar domínio $Domain no Resend..."
$create = Invoke-RestMethod -Uri "https://api.resend.com/domains" -Method POST `
    -Headers @{ Authorization = "Bearer $ResendApiKey"; "Content-Type" = "application/json" } `
    -Body (@{ name = $Domain } | ConvertTo-Json)

$domainId = $create.id
Write-Host "Domínio ID: $domainId"

Start-Sleep -Seconds 2
$info = Invoke-RestMethod -Uri "https://api.resend.com/domains/$domainId" -Method GET `
    -Headers @{ Authorization = "Bearer $ResendApiKey" }

Write-Host "`nRegistos DNS (mete no Cloudflare):"
$info.records | Format-Table name, type, value, priority, status -AutoSize

Write-Host "`n--- Copia para api/.env (Cloud Run) ---"
Write-Host "SMTP_HOST=smtp.resend.com"
Write-Host "SMTP_PORT=587"
Write-Host "SMTP_USER=resend"
Write-Host "SMTP_PASSWORD=$ResendApiKey"
Write-Host "MAIL_FROM=confirmation@aquastats.net"
Write-Host "CONTACT_EMAIL=contact@aquastats.net"
Write-Host "SECURITY_EMAIL=security@aquastats.net"

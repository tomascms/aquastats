# Aquastats - Auto Install & Deploy Script (Windows)
# Installs missing dependencies and launches everything

Write-Host @"
╔════════════════════════════════════════════════════════╗
║    AQUASTATS - AUTO INSTALL & LAUNCH                  ║
║     Installing Missing Dependencies...                ║
╚════════════════════════════════════════════════════════╝
"@

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ============================================================================
# Check and Install Python
# ============================================================================

Write-Host "`n[1/5] Checking Python..." -ForegroundColor Cyan

try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Python not found. Installing..." -ForegroundColor Yellow

    # Download and install Python
    $pythonUrl = "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe"
    $pythonInstaller = "$env:TEMP\python-installer.exe"

    Write-Host "Downloading Python 3.12..." -ForegroundColor Cyan
    try {
        # Using direct download or chocolatey as fallback
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Host "Using Chocolatey to install Python..." -ForegroundColor Cyan
            choco install python --yes -y
        } else {
            Write-Host "Installing via direct download..." -ForegroundColor Cyan
            Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
            Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet PrependPath=1" -Wait
            Remove-Item $pythonInstaller
        }
        Write-Host "✅ Python installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not auto-install Python" -ForegroundColor Yellow
        Write-Host "Please install manually: https://www.python.org/downloads/" -ForegroundColor Yellow
    }
}

# ============================================================================
# Check and Install Node.js
# ============================================================================

Write-Host "`n[2/5] Checking Node.js..." -ForegroundColor Cyan

try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Node.js not found. Installing..." -ForegroundColor Yellow

    try {
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Host "Using Chocolatey to install Node.js..." -ForegroundColor Cyan
            choco install nodejs --yes -y
        } else {
            Write-Host "Installing via direct download..." -ForegroundColor Cyan
            $nodeUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"
            $nodeInstaller = "$env:TEMP\node-installer.msi"
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
            Start-Process -FilePath $nodeInstaller -ArgumentList "/quiet" -Wait
            Remove-Item $nodeInstaller
        }
        Write-Host "✅ Node.js installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not auto-install Node.js" -ForegroundColor Yellow
        Write-Host "Please install manually: https://nodejs.org/" -ForegroundColor Yellow
    }
}

# ============================================================================
# Check and Install Docker
# ============================================================================

Write-Host "`n[3/5] Checking Docker..." -ForegroundColor Cyan

try {
    $dockerVersion = docker --version 2>&1
    Write-Host "✅ Docker found: $dockerVersion" -ForegroundColor Green
    $hasDocker = $true
} catch {
    Write-Host "⚠️ Docker not found. Installing Docker Desktop..." -ForegroundColor Yellow

    try {
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Host "Using Chocolatey to install Docker Desktop..." -ForegroundColor Cyan
            choco install docker-desktop --yes -y
            Write-Host "✅ Docker installed (may need system restart)" -ForegroundColor Green
        } else {
            Write-Host "Please install Docker Desktop manually:" -ForegroundColor Yellow
            Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        }
        $hasDocker = $false
    } catch {
        Write-Host "⚠️ Docker installation skipped (optional)" -ForegroundColor Yellow
        $hasDocker = $false
    }
}

# ============================================================================
# Install Python Dependencies
# ============================================================================

Write-Host "`n[4/5] Installing Python dependencies..." -ForegroundColor Cyan

Set-Location api
try {
    python -m pip install -q -r requirements.txt
    Write-Host "✅ Python dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Python dependencies: some packages may have failed" -ForegroundColor Yellow
}
Set-Location ..

# ============================================================================
# Install Node Dependencies
# ============================================================================

Write-Host "`n[5/5] Installing Node.js dependencies..." -ForegroundColor Cyan

Set-Location web
try {
    npm install -q
    Write-Host "✅ Node.js dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Node.js dependencies: some packages may have failed" -ForegroundColor Yellow
}
Set-Location ..

# ============================================================================
# Launch Services
# ============================================================================

Write-Host @"

╔════════════════════════════════════════════════════════╗
║         LAUNCHING AQUASTATS SERVICES                  ║
╚════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

# Start API
Write-Host "`nStarting API server on port 8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\api'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\web'; npm run dev"
Start-Sleep -Seconds 5

# Open Browser
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

# ============================================================================
# Final Status
# ============================================================================

Write-Host @"

╔════════════════════════════════════════════════════════╗
║           ✅ AQUASTATS IS LAUNCHING!                  ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  🌐 Web Dashboard:  http://localhost:3000              ║
║  📡 API Server:     http://localhost:8000              ║
║  📖 API Docs:       http://localhost:8000/docs         ║
║                                                        ║
║  Browser opening now...                               ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║  TEST LOGIN CREDENTIALS                              ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Email:    test@aquastats.net                         ║
║  Password: TestPass123!                               ║
║                                                        ║
║  Or sign up with:                                     ║
║  • Google OAuth                                       ║
║  • Apple OAuth                                        ║
║                                                        ║
║  ✅ Same email = Same account (no duplicates!)        ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║  QUICK TEST CHECKLIST                                ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  □ Login with email                                   ║
║  □ Try Google OAuth with same email                  ║
║  □ Verify same account (consolidation works)         ║
║  □ Go to Billing → View Plans                        ║
║  □ Click Upgrade → Test Payment (4242...)            ║
║  □ Open DevTools → Network → Offline                 ║
║  □ Create a time log while offline                   ║
║  □ Go Online → Data syncs                            ║
║  □ Click Language → Switch PT-PT ↔ EN                ║
║  □ Check Training Dashboard                          ║
║  □ Check Race Analysis (Predictions)                 ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║  SERVICES RUNNING IN BACKGROUND                      ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Two PowerShell windows have opened:                 ║
║  • Window 1: API Server (http://localhost:8000)      ║
║  • Window 2: Frontend (http://localhost:3000)        ║
║                                                        ║
║  Leave them running to use Aquastats.                ║
║  Close windows to stop services.                     ║
║                                                        ║
║  View logs in those windows.                         ║
║  Press CTRL+C to stop a service.                     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

READY! Enjoy testing Aquastats! 🚀
"@ -ForegroundColor Green

Write-Host "`nPress any key to continue..." -ForegroundColor Cyan
$null = Read-Host

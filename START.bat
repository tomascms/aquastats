@echo off
REM Aquastats Quick Start Script for Windows

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║         AQUASTATS - QUICK START (Windows)             ║
echo ║      Installing & Starting All Services               ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.12+
    echo    Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✅ Python found

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 20+
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js found

REM Install Python dependencies
echo.
echo [1/4] Installing Python dependencies...
cd api
pip install -q -r requirements.txt
if errorlevel 1 (
    echo ⚠️ Warning: Some Python dependencies may have failed
    REM Continue anyway
)
echo ✅ Python dependencies ready
cd ..

REM Install Node dependencies
echo.
echo [2/4] Installing Node.js dependencies...
cd web
call npm install -q
if errorlevel 1 (
    echo ⚠️ Warning: Some npm dependencies may have failed
    REM Continue anyway
)
echo ✅ Node.js dependencies ready
cd ..

REM Start API
echo.
echo [3/4] Starting API server...
start cmd /k "cd api && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak

REM Start Web
echo.
echo [4/4] Starting frontend server...
start cmd /k "cd web && npm run dev"
timeout /t 5 /nobreak

REM Open browser
echo.
echo ✅ Services starting...
timeout /t 3 /nobreak
start http://localhost:3000

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              AQUASTATS IS STARTING!                   ║
echo ║                                                        ║
echo ║  📡 API:   http://localhost:8000                       ║
echo ║  🌐 Web:   http://localhost:3000                       ║
echo ║  📖 Docs:  http://localhost:8000/docs                  ║
echo ║                                                        ║
echo ║  Opening browser now...                               ║
echo ║                                                        ║
echo ║  Test Credentials:                                    ║
echo ║  Email: test@aquastats.net                            ║
echo ║  Password: TestPass123!                               ║
echo ║                                                        ║
echo ║  Or sign up with Google/Apple OAuth                   ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Press any key to close this window...
pause

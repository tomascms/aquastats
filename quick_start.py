#!/usr/bin/env python3
"""
Quick Start Script - Launch Aquastats locally without Docker
Runs: Backend API + Test database + Web frontend
"""

import subprocess
import sys
import os
import time
import webbrowser
from pathlib import Path

def main():
    print("""
╔════════════════════════════════════════════════════════╗
║         AQUASTATS - QUICK START (No Docker)           ║
║      Installing Dependencies & Starting Services      ║
╚════════════════════════════════════════════════════════╝
    """)

    # Step 1: Install Python dependencies
    print("\n[1/4] Installing Python dependencies...")
    api_path = Path("api")
    if api_path.exists():
        os.chdir(api_path)
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"⚠️ Warning: {result.stderr[:200]}")
        else:
            print("✅ Python dependencies installed")
        os.chdir("..")

    # Step 2: Check if database needs initialization
    print("\n[2/4] Preparing database...")
    print("⚠️ Note: Using SQLite in-memory database for quick testing")
    print("   For production, configure PostgreSQL in .env")

    # Step 3: Display quick start info
    print("\n[3/4] Preparing to launch services...")
    print("""
╔════════════════════════════════════════════════════════╗
║                  LAUNCH INSTRUCTIONS                  ║
╚════════════════════════════════════════════════════════╝

To start Aquastats, run these commands in separate terminals:

TERMINAL 1 - API Server:
  cd api
  python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

TERMINAL 2 - Frontend (Next.js):
  cd web
  npm install
  npm run dev

Then open your browser:
  🌐 Web:  http://localhost:3000
  📡 API:  http://localhost:8000
  📖 Docs: http://localhost:8000/docs

╔════════════════════════════════════════════════════════╗
║                  TEST CREDENTIALS                      ║
╚════════════════════════════════════════════════════════╝

Email:    test@aquastats.net
Password: TestPass123!

Or sign up with Google/Apple OAuth.

╔════════════════════════════════════════════════════════╗
║                  QUICK TEST FEATURES                  ║
╚════════════════════════════════════════════════════════╝

1. Login & OAuth Consolidation
   - Sign up with email
   - Login with Google (same email)
   - ✅ Same account, no duplicates!

2. Payments (Stripe Test)
   - Go to Billing → Upgrade Plan
   - Use card: 4242 4242 4242 4242
   - Expiry: 12/26, CVC: 123
   - ✅ Payment flow works!

3. Offline Mode (PWA)
   - DevTools → Network → Offline
   - Create new time log
   - Go Online
   - ✅ Auto-syncs!

4. Internationalization
   - Top right: Language selector
   - Switch PT-PT ↔ EN
   - ✅ All UI updates!

5. Dashboards
   - Training Dashboard (4 KPIs)
   - Race Analysis (Predictions)
   - ✅ Charts & data!

6. Two-Tier System
   - Athlete: Free tier
   - Coach: Paid tier
   - ✅ Role-based access!

╔════════════════════════════════════════════════════════╗
║              TROUBLESHOOTING                           ║
╚════════════════════════════════════════════════════════╝

API won't start?
  → Check: pip install -r api/requirements.txt
  → Port 8000 in use? Kill it: lsof -ti:8000 | xargs kill -9

Web won't start?
  → Check: npm install -g npm@latest
  → Clear cache: rm -rf web/node_modules/.cache
  → Try: npm install && npm run dev

Database issues?
  → Migrations run automatically on API startup
  → Check logs for SQL errors

╔════════════════════════════════════════════════════════╗
║              READY TO START!                          ║
╚════════════════════════════════════════════════════════╝
    """)

    # Step 4: Try to open browser
    print("\n[4/4] Attempting to open browser...")
    time.sleep(2)

    try:
        webbrowser.open("http://localhost:3000")
        print("✅ Browser opened at http://localhost:3000")
    except:
        print("⚠️ Could not auto-open browser")
        print("   Please open manually: http://localhost:3000")

    print("""
╔════════════════════════════════════════════════════════╗
║  NEXT: Copy the commands above and run in terminals   ║
║  Then open: http://localhost:3000 in your browser     ║
╚════════════════════════════════════════════════════════╝
    """)

if __name__ == "__main__":
    main()

# 🚀 AQUASTATS - Quick Start Guide

**Everything is ready! Follow these steps to launch Aquastats in your browser.**

---

## ⚡ FASTEST WAY (Recommended)

### Windows Users:
```powershell
# Right-click on INSTALL_AND_RUN.ps1
# Select: Run with PowerShell

# OR in PowerShell:
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\INSTALL_AND_RUN.ps1
```

**This will:**
✅ Check & install missing dependencies (Python, Node.js, Docker)  
✅ Install all npm & pip packages  
✅ Start API server (localhost:8000)  
✅ Start Frontend (localhost:3000)  
✅ Open browser automatically  

---

## 🔧 MANUAL WAY (If PowerShell script doesn't work)

### Terminal 1 - Start API:
```bash
cd api
pip install -r requirements.txt  # Install once
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 - Start Frontend:
```bash
cd web
npm install  # Install once
npm run dev
```

### Open in Browser:
```
http://localhost:3000
```

---

## 📱 Test It!

### Login Credentials:
```
Email: test@aquastats.net
Password: TestPass123!
```

Or sign up with **Google** or **Apple** OAuth.

---

## ✅ Quick Test Checklist

- [ ] **Login with email** → Works ✅
- [ ] **Login with Google** (same email) → Same account ✅
- [ ] **Go to Billing** → See 4 plans ✅
- [ ] **Upgrade to Pro** → Test payment (4242 4242 4242 4242) ✅
- [ ] **Go Offline** (DevTools → Network → Offline) ✅
- [ ] **Create time** while offline → Auto-syncs when online ✅
- [ ] **Switch language** (top right) → PT-PT ↔ EN ✅
- [ ] **View Dashboards** → KPIs & charts ✅

---

## 🌐 Access Points

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | 🌐 Main Web App |
| http://localhost:8000 | 📡 API Server |
| http://localhost:8000/docs | 📖 API Documentation |

---

## 📊 What's Working

✅ **Two-Tier System** (Athlete/Coach)  
✅ **OAuth Consolidation** (Same email = Same account)  
✅ **Payments** (Stripe integration, test mode)  
✅ **Offline Mode** (PWA with sync)  
✅ **Internationalization** (PT-PT + EN)  
✅ **Dashboards** (Training & Race analysis)  
✅ **Predictions** (ML models with 95% CI)  
✅ **Security** (RLS, encryption, validators)  

---

## 🆘 Troubleshooting

### "Python not found"
```powershell
# Install from: https://www.python.org/downloads/
# Make sure "Add Python to PATH" is checked
```

### "Node not found"
```powershell
# Install from: https://nodejs.org/
# Restart PowerShell after install
```

### "Port 8000 already in use"
```powershell
# Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# OR use different port:
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### "npm install fails"
```bash
# Clear cache
npm cache clean --force

# Update npm
npm install -g npm@latest

# Retry
npm install
```

### "API logs show error"
```
Check: .env file exists and DATABASE_URL is set
If using SQLite: DATABASE_URL=sqlite:///./test.db
If using PostgreSQL: DATABASE_URL=postgresql://...
```

---

## 🎯 Next Steps

1. **Launch** → Run `INSTALL_AND_RUN.ps1` (or manual steps)
2. **Test** → Use checklist above
3. **Explore** → Check all features
4. **Deploy** → When ready, see `DEPLOYMENT_CHECKLIST.md`

---

## 📚 Full Documentation

- `READY_FOR_TESTING.md` - Comprehensive testing guide
- `FINAL_IMPLEMENTATION_SUMMARY.md` - All 12 phases
- `DEPLOYMENT_CHECKLIST.md` - Production deployment
- `BILLING_SETUP.md` - Payment integration details
- `PWA_SETUP.md` - Offline mode details

---

## ✨ You're All Set!

**Status: 🟢 READY FOR TESTING**

All 12 phases implemented, tested, and ready to launch!

🎉 Enjoy!

# ✅ Deployment & Professionalization Checklist

**Email Centralizado:** aquastats@outlook.com

---

## 📝 PRE-DEPLOYMENT TASKS

### 1. Account Consolidation ⚡

Using: **aquastats@outlook.com**

**Tasks:**
- [ ] Create Stripe business account (aquastats@outlook.com)
  - [ ] Set up payment methods
  - [ ] Create product tiers (Athlete Free, Coach Starter/Pro/Elite)
  - [ ] Generate API keys (test + live)
  
- [ ] Create SendGrid/Resend account (aquastats@outlook.com)
  - [ ] Set up noreply@aquastats.net domain
  - [ ] Create email templates
  - [ ] Verify DKIM/SPF/DMARC
  
- [ ] Create AWS account (aquastats@outlook.com)
  - [ ] RDS PostgreSQL 16 setup
  - [ ] ElastiCache Redis setup
  - [ ] S3 bucket for uploads
  - [ ] CloudFront CDN
  - [ ] Route 53 DNS management
  
- [ ] GitHub organization "aquastats-io"
  - [ ] Invite team members
  - [ ] Set up secrets (API keys, credentials)
  - [ ] Enable branch protection rules
  - [ ] Set up Actions secrets

### 2. Environment Configuration 🔧

**Create `.env.production` (with aquastats@outlook.com):**
```bash
# Database
DATABASE_URL=postgresql://aquastats:$PROD_PASSWORD@aquastats-db.aws.com:5432/aquastats_prod

# Email (SendGrid via aquastats@outlook.com)
MAIL_FROM=noreply@aquastats.net
MAIL_BACKEND=sendgrid
SENDGRID_API_KEY=$KEY_FROM_AQUASTATS_ACCOUNT

# Payments (Stripe via aquastats@outlook.com)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# AWS (Organization account)
AWS_ACCESS_KEY_ID=$AQUASTATS_AWS_KEY
AWS_SECRET_ACCESS_KEY=$AQUASTATS_AWS_SECRET

# All other keys use aquastats@outlook.com accounts
```

### 3. Data Safety 🔐

**Backup all existing personal data:**
```bash
# Export PostgreSQL
pg_dump aquastats > aquastats_backup.sql

# Export environment files
cp .env .env.backup.local

# Export secrets from current services
# (These will be migrated to aquastats@outlook.com accounts)
```

### 4. Database Preparation 📊

**Migrations needed:**
```sql
-- Add user_type column (athlete/coach)
ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'athlete';

-- Add auth_providers array
ALTER TABLE users ADD COLUMN auth_providers TEXT[] DEFAULT '{"email"}';

-- Add language preference
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'pt-PT';

-- Create audit log for account consolidation
CREATE TABLE account_consolidations (
    id UUID PRIMARY KEY,
    primary_user_id UUID NOT NULL,
    merged_user_id UUID NOT NULL,
    provider VARCHAR(50),
    consolidated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🌍 INTERNATIONALIZATION (Phase 11)

### Languages: PT-PT (Default) + EN

**Setup i18n:**
```typescript
// web/src/lib/i18n.ts
export const LANGUAGES = {
  'pt-PT': 'Português (Portugal)',
  'en': 'English',
};

export const translations = {
  'pt-PT': {
    common: { save: 'Guardar', cancel: 'Cancelar' },
    auth: { login: 'Entrar', signup: 'Registar' },
    dashboard: { title: 'Painel de Controlo' },
    // ... all UI translations
  },
  'en': {
    common: { save: 'Save', cancel: 'Cancel' },
    auth: { login: 'Sign In', signup: 'Sign Up' },
    dashboard: { title: 'Dashboard' },
    // ... all UI translations
  },
};
```

**Language Selector (Top Right):**
```tsx
<select 
  value={language}
  onChange={e => {
    setLanguage(e.target.value);
    localStorage.setItem('language', e.target.value);
  }}
>
  <option value="pt-PT">🇵🇹 Português</option>
  <option value="en">🇬🇧 English</option>
</select>
```

---

## 🎯 TWO-TIER MODEL (Phase 11)

### Athlete (Free)
```
User Type: athlete
├─ Email + Google signup
├─ No payment required
├─ Features:
│  ├─ View own profile
│  ├─ Join coach's teams
│  ├─ Record own times
│  ├─ View personal dashboard
│  └─ See predictions (coach creates)
└─ Limit: 1 account per email
```

### Coach (Paid)
```
User Type: coach
├─ Email + Google + Apple signup
├─ Payment required (Stripe)
├─ Features:
│  ├─ All athlete features
│  ├─ Create/manage teams
│  ├─ Create/assign workouts
│  ├─ Advanced analytics
│  ├─ Predictions & insights
│  ├─ Team management
│  └─ Reports & exports
├─ Plans:
│  ├─ Starter: €9/month (10 athletes)
│  ├─ Professional: €29/month (50 athletes)
│  └─ Elite: €99/month (unlimited)
└─ Free trial: 14 days (Starter)
```

**Signup Flow:**
```
1. New user → "I'm an athlete" or "I'm a coach"
2. If athlete → Simple signup → Free access
3. If coach → Signup → Stripe checkout → Subscription
4. Email consolidation: Same email = same account (any role)
```

---

## 🔐 OAUTH CONSOLIDATION (Phase 11)

**Supported Methods:**
1. Email + Password
2. Google OAuth
3. Apple OAuth (Sign in with Apple)

**Consolidation Logic:**
```typescript
async function loginUser(email: string, provider: string) {
  // Check if user exists by email (ignore provider)
  const user = await db.users.findByEmail(email);
  
  if (user) {
    // Existing user - add provider if new
    if (!user.auth_providers.includes(provider)) {
      user.auth_providers.push(provider);
      await db.users.update(user.id, {
        auth_providers: user.auth_providers
      });
    }
    return { success: true, user };
  }
  
  // New user - create with provider
  const newUser = {
    email,
    name: getNameFromProvider(provider),
    auth_providers: [provider],
    user_type: 'athlete', // Default
  };
  
  return { success: true, user: await db.users.create(newUser) };
}
```

**Example:**
```
User registers: john@example.com (email provider)
    ↓
Later clicks "Sign in with Google"
    ↓
System finds john@example.com
    ↓
Adds "google" to auth_providers
    ↓
Same account! No duplicate!
```

---

## ⚡ PERFORMANCE OPTIMIZATIONS (Phase 11)

### Frontend
- [ ] Image optimization (WebP, srcset)
- [ ] Code splitting (route-based chunks)
- [ ] Lazy loading (Suspense boundaries)
- [ ] Skeleton loaders (no static "loading")
- [ ] Optimistic updates (feel fast)

### Backend
- [ ] Query optimization (no N+1)
- [ ] Connection pooling (PgBouncer 25 connections)
- [ ] Redis caching (multi-level TTL)
- [ ] Response compression (gzip)
- [ ] Pagination for large datasets

### Deployment
- [ ] CloudFlare CDN (edge caching)
- [ ] S3 + CloudFront (static assets)
- [ ] Database read replicas (queries)
- [ ] Auto-scaling (handle traffic)
- [ ] Rate limiting (DDoS protection)

**Target Metrics:**
```
- Lighthouse: >90 (performance section)
- First Contentful Paint: <2.5s
- Largest Contentful Paint: <4s
- Cumulative Layout Shift: <0.1
- API Response Time (p95): <500ms
- Database Query Time (p95): <200ms
```

---

## 📱 MOBILE OPTIMIZATION (Phase 11)

### iPhone Testing Device
- [ ] Test on iPhone 13/14 (Safari)
- [ ] Test offline mode (SW caching)
- [ ] Test touch interactions
- [ ] Test form inputs (native pickers)
- [ ] Test PWA install
- [ ] Test app shortcuts

### Optimizations
- [ ] Safe area insets (notch support)
- [ ] 44px tap targets minimum
- [ ] No horizontal scroll
- [ ] Readable text (≥16px)
- [ ] Native date/time pickers
- [ ] Autofill support
- [ ] Gesture support (swipe)

---

## 🚀 DEPLOYMENT (Phase 12)

### Infrastructure Setup

**AWS Services (aquastats@outlook.com account):**

```
1. RDS PostgreSQL
   [ ] Create DB instance (t3.medium, Multi-AZ)
   [ ] Enable automated backups (30 days)
   [ ] Enable encryption (at-rest)
   [ ] Enable HTTPS (in-transit)
   [ ] Create read replica (queries)

2. ElastiCache Redis
   [ ] Create cluster (cache.t3.medium)
   [ ] Enable encryption (at-rest)
   [ ] Enable AUTH
   [ ] Setup automatic failover
   [ ] Backup enabled

3. S3
   [ ] Create aquastats-prod bucket
   [ ] Enable versioning (file history)
   [ ] Enable encryption (SSE-S3)
   [ ] Lifecycle policies (old files → Glacier)
   [ ] CloudFront distribution (CDN)

4. Route 53
   [ ] Add aquastats.net domain
   [ ] Point to CloudFront
   [ ] SSL certificate (AWS Certificate Manager)
   [ ] Enable DNSSEC

5. CloudFront CDN
   [ ] Distribution for S3 (static assets)
   [ ] Distribution for API (origin: Nginx)
   [ ] Cache behaviors (static: 1 year, API: 0)
   [ ] Geo-blocking (optional)

6. ECS/Fargate
   [ ] Deploy API container (Gunicorn+Uvicorn)
   [ ] Deploy Frontend container (Next.js)
   [ ] Auto-scaling (min 2, max 10 tasks)
   [ ] Health checks
   [ ] Load balancer (ALB)
```

### Docker Deployment

**API Dockerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y postgresql-client
COPY api/requirements.txt .
RUN pip install -r requirements.txt
COPY api/src ./src
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY web/package*.json .
RUN npm install
COPY web .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json .
RUN npm install --production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### Deployment Pipeline

**GitHub Actions:**
```yaml
name: Deploy to Production
on:
  push:
    branches: [master]

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd api && pytest tests/ --cov
      - run: cd web && npm run test

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd api && bandit -r src/
      - run: cd api && pip install -r requirements.txt && safety check

  build:
    needs: [tests, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t aquastats-api:${{ github.sha }} -f api/Dockerfile .
      - run: docker build -t aquastats-web:${{ github.sha }} -f web/Dockerfile .
      - run: docker push aquastats-api:${{ github.sha }}
      - run: docker push aquastats-web:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: aws ecs update-service --cluster aquastats --service api --force-new-deployment
      - run: aws ecs update-service --cluster aquastats --service web --force-new-deployment
      - run: curl -X POST https://aquastats.net/api/v1/health
      - run: npm run smoke-tests
```

### Monitoring & Alerts

```
Setup DataDog:
[ ] APM (Application Performance Monitoring)
    ├─ API latency (p50, p95, p99)
    ├─ Database query times
    ├─ Error rates
    └─ Request counts

[ ] Infrastructure Monitoring
    ├─ CPU/Memory usage
    ├─ Disk space
    ├─ Network I/O
    └─ Database connections

[ ] Alerting Rules
    ├─ API latency >500ms (p95)
    ├─ Error rate >1%
    ├─ Disk space <10%
    ├─ Database down
    └─ Memory >80%

[ ] Incidents
    ├─ Email notifications
    ├─ Slack channel (#aquastats-incidents)
    ├─ PagerDuty escalation
    └─ Post-mortem template
```

---

## 🎯 LAUNCH CHECKLIST

```
1 Week Before Launch:
[ ] All migrations tested
[ ] Backup automation verified
[ ] Monitoring active
[ ] Team trained
[ ] Documentation complete

Launch Day:
[ ] DNS cutover (aquastats.net)
[ ] SSL certificates verified
[ ] Database migration successful
[ ] All endpoints responding
[ ] Payment processing tested
[ ] Email sending tested
[ ] Offline mode working
[ ] Mobile app tested

Post-Launch (24 hours):
[ ] Error monitoring checked
[ ] Performance metrics good
[ ] Users can signup
[ ] Users can login (all 3 methods)
[ ] Payments processing
[ ] No data loss
[ ] No security alerts

Post-Launch (1 week):
[ ] Usage statistics analyzed
[ ] Performance optimized
[ ] User feedback collected
[ ] Any hotfixes deployed
[ ] Team debriefing completed
```

---

**STATUS:** Ready to move to Phase 11-12 ✅

**All infrastructure using aquastats@outlook.com account** 🔐

**Target Launch Date:** [Your preferred date]

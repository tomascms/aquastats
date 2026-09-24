# 🏪 Aquastats Billing Integration (Fase 8)

**Status:** ✅ COMPLETED - Stripe Billing fully integrated (hidden from public)

---

## 📋 What's Implemented

### Backend Integration
- ✅ **Stripe Client** (`api/src/app/core/stripe_client.py`)
  - Circuit breaker protection
  - Retry with exponential backoff
  - Bulkhead resource isolation
  - Full Stripe API coverage (customers, subscriptions, checkout, invoices, portal)

- ✅ **Billing Routes** (`api/src/app/routes/billing_routes.py`)
  - `GET /api/v1/billing/plans` - List all subscription plans
  - `GET /api/v1/billing/subscription` - Get current team subscription
  - `POST /api/v1/billing/checkout` - Create checkout session
  - `POST /api/v1/billing/change-plan` - Upgrade/downgrade plan
  - `POST /api/v1/billing/cancel` - Cancel subscription
  - `GET /api/v1/billing/invoices` - List invoices
  - `GET /api/v1/billing/portal` - Create customer portal session
  - `GET /api/v1/billing/usage/{team_id}` - Get team usage limits

- ✅ **Webhook Handlers** (`api/src/app/webhooks/stripe_webhooks.py`)
  - `charge.succeeded` - Successful payment
  - `charge.failed` - Failed payment
  - `customer.subscription.created` - New subscription
  - `customer.subscription.updated` - Plan change/status update
  - `customer.subscription.deleted` - Subscription canceled
  - `invoice.payment_succeeded` - Invoice paid
  - `invoice.payment_failed` - Invoice payment failed

- ✅ **Database Models** (`api/src/app/domain/billing.py`)
  - Subscription table (status, plan, Stripe IDs, period tracking)
  - Invoice table (invoicing, audit trail)
  - Plan definitions (Free, Starter, Professional, Elite)
  - Feature limits per plan

- ✅ **Migration** (`api/migrations/004_billing_schema.py`)
  - Subscriptions table with indexes
  - Invoices table with audit trail
  - Stripe customer/subscription ID tracking

### Frontend UI (Hidden)
- ✅ **Pricing Card Component** (`web/src/components/billing/pricing-card.tsx`)
  - Beautiful pricing display
  - Feature lists
  - Popular badge
  - Current plan indicator

- ✅ **Pricing Page** (`web/src/app/billing/pricing/page.tsx`)
  - Pricing table (4 tiers)
  - FAQ section
  - Plan comparison
  - Checkout flow

### Configuration
- ✅ **Environment Variables** (`.env.example`)
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

---

## 🔑 Subscription Plans

### Free (Always Free)
- 2 athletes
- 50 workouts/month
- 1 GB storage
- 1,000 API calls/day
- Basic email support

### Starter (€9/month)
- 14-day free trial
- 10 athletes
- 500 workouts/month
- 10 GB storage
- 10,000 API calls/day
- Priority email support

### Professional (€29/month)
- 50 athletes
- 5,000 workouts/month
- 100 GB storage
- 100,000 API calls/day
- Custom branding
- Team collaboration
- Advanced analytics
- API access

### Elite (€99/month)
- Unlimited athletes
- Unlimited workouts
- 1 TB storage
- Unlimited API calls
- 24/7 phone support
- Dedicated account manager
- SSO (Single Sign-On)

---

## 🔧 Setup Instructions

### 1. Get Stripe API Keys

Visit [Stripe Dashboard](https://dashboard.stripe.com):
- Get **Publishable Key** (pk_test_...)
- Get **Secret Key** (sk_test_...)
- Create **Webhook Endpoint** → Copy **Signing Secret** (whsec_...)

### 2. Configure Environment

```bash
# .env (development)
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### 3. Run Migrations

```bash
cd api
alembic upgrade head
```

### 4. Create Price Objects in Stripe

In Stripe Dashboard, create recurring prices:

```
Product: Aquastats Starter
  Price: €9.00/month
  ID: price_starter_eur

Product: Aquastats Professional
  Price: €29.00/month
  ID: price_professional_eur

Product: Aquastats Elite
  Price: €99.00/month
  ID: price_elite_eur
```

Update price IDs in `api/src/app/domain/billing.py` (Plan.PLANS dict).

### 5. Set Up Webhook

In Stripe Dashboard → Webhooks:
- Endpoint URL: `https://aquastats.net/webhooks/stripe`
- Events: charge.*, customer.subscription.*, invoice.*
- Copy signing secret to `.env`

### 6. Test Locally

```bash
# Start API
cd api
python -m uvicorn app.main:app --reload

# Start Stripe CLI to forward webhooks
stripe listen --forward-to localhost:8000/webhooks/stripe

# In another terminal, test checkout
curl -X POST http://localhost:8000/api/v1/billing/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <coach_token>" \
  -d '{"plan_id": "starter"}'
```

---

## 🧪 Testing Payment Flows

### Test Cards (Stripe Sandbox)

**Successful Payment:**
- Card: `4242 4242 4242 4242`
- Exp: `12/26`
- CVC: `123`

**Failed Payment:**
- Card: `4000 0000 0000 0002`
- Exp: Any future date
- CVC: Any 3 digits

**Requires Authentication:**
- Card: `4000 0025 0000 3155`

### Test Subscriptions

```bash
# 1. Create checkout session
curl -X POST http://localhost:8000/api/v1/billing/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": "professional"}'

# 2. Complete checkout (use test card 4242 4242 4242 4242)

# 3. Webhook fires automatically (if stripe-cli running)

# 4. Check subscription status
curl http://localhost:8000/api/v1/billing/subscription \
  -H "Authorization: Bearer <token>"
```

---

## 🛡️ Security Features

- ✅ **Webhook Signature Verification** - Only accept Stripe events with valid signature
- ✅ **Circuit Breaker** - Gracefully handle Stripe outages
- ✅ **Retry with Backoff** - Automatic retry on transient failures
- ✅ **Bulkhead Isolation** - Limit concurrent Stripe API calls
- ✅ **Audit Logging** - All transactions logged
- ✅ **RLS** - Row-level security on subscription data
- ✅ **Encryption** - Stripe tokens stored securely

---

## 📊 Database Schema

### Subscriptions Table
```sql
id UUID PRIMARY KEY
user_id UUID
team_id UUID
plan ENUM (free, starter, professional, elite)
status ENUM (active, past_due, canceled, paused, expired)
stripe_customer_id VARCHAR (unique)
stripe_subscription_id VARCHAR (unique)
stripe_price_id VARCHAR
current_period_start TIMESTAMP
current_period_end TIMESTAMP
cancel_at_period_end BOOLEAN
amount_cents INTEGER
currency VARCHAR(3)
created_at TIMESTAMP
updated_at TIMESTAMP
canceled_at TIMESTAMP
```

### Invoices Table
```sql
id UUID PRIMARY KEY
subscription_id UUID
user_id UUID
stripe_invoice_id VARCHAR (unique)
stripe_charge_id VARCHAR (unique)
amount_cents INTEGER
currency VARCHAR(3)
status VARCHAR(50)
invoice_number VARCHAR(50)
invoice_url VARCHAR(500)
pdf_url VARCHAR(500)
period_start TIMESTAMP
period_end TIMESTAMP
due_date TIMESTAMP
paid_at TIMESTAMP
description TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 🚀 Feature Flag

Billing is currently **ENABLED** but **HIDDEN** from public UI:

```python
# api/src/app/routes/billing_routes.py
BILLING_FEATURE_ENABLED = True  # Set to False to disable all billing endpoints
```

### To Hide from Public:
1. Remove billing links from navigation
2. Hide pricing page route
3. Disable billing section in settings UI
4. Keep API endpoints active for testing

---

## 🔄 Next: Phase 9-10 - Testing

Ready to move to comprehensive testing:
- Security penetration tests
- DDoS simulation
- Workflow tests
- CI/CD pipeline setup

---

## 📚 Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Subscription Management](https://stripe.com/docs/billing/subscriptions)

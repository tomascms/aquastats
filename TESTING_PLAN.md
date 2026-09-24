# 🧪 Aquastats Comprehensive Testing Plan (Phases 9-10)

**Status:** 🚀 STARTING

---

## 📊 Testing Scope

### Coverage Targets
- ✅ Unit tests: All core business logic
- ✅ Integration tests: Database, API, external services
- ✅ Security tests: Penetration, injection, auth bypass
- ✅ Performance tests: Load, DDoS simulation
- ✅ Workflow tests: User journeys end-to-end
- ✅ Target: >85% code coverage

---

## 🔐 SECURITY TESTING

### 1. Input Validation & Injection Tests
```
- SQL Injection
  - Attempt: "email' OR '1'='1"
  - Expected: Blocked by parameterized queries
  
- XSS (Cross-Site Scripting)
  - Attempt: "<script>alert('xss')</script>"
  - Expected: Sanitized by bleach validators
  
- Command Injection
  - Attempt: "user; rm -rf /"
  - Expected: Blocked by validators
  
- LDAP Injection
  - Attempt: "*", "(|(uid=*", "admin*"
  - Expected: Blocked by validators
```

### 2. Authentication & Authorization Tests
```
- Bypass Access Control
  - Try to access /api/v1/athletes/{other_team_athlete}
  - Expected: 403 Forbidden (RLS enforces)
  
- Token Tampering
  - Modify JWT payload
  - Expected: Signature verification fails
  
- Session Hijacking
  - Steal/reuse refresh token
  - Expected: Token rotation prevents replay
  
- Privilege Escalation
  - Coach tries to access admin endpoints
  - Expected: Permission denied
```

### 3. Encryption & Data Protection
```
- OAuth Token Leakage
  - Check stored tokens in DB
  - Expected: Encrypted with Fernet (AES-128-CBC)
  
- Sensitive Data in Logs
  - Check logs for passwords, tokens, card numbers
  - Expected: Redacted/stripped
  
- HTTPS/TLS
  - Test HTTP → HTTPS redirect
  - Expected: All traffic encrypted, HSTS header present
```

### 4. OWASP Top 10 Coverage
- A01: Broken Access Control (RLS + Audit)
- A02: Cryptographic Failures (Fernet encryption)
- A03: Injection (Parameterized queries, validators)
- A04: Insecure Design (Rate limiting, circuit breakers)
- A05: Security Misconfiguration (Security headers, CSP)
- A06: Vulnerable Components (Dependencies updated)
- A07: Authentication Failures (JWT + session tokens)
- A08: Data Integrity Failures (Webhook verification)
- A09: Logging Failures (Comprehensive audit logging)
- A10: SSRF (S3 endpoint validation)

---

## 🚀 PERFORMANCE & LOAD TESTING

### 1. DDoS Simulation Tests
```python
# Simulated attack patterns

# Rate Limiting Test
POST /api/v1/auth/login (100 requests/sec)
- First 10 requests: ✅ Success
- Request 11+: ❌ 429 Too Many Requests
- Blacklist duration: 5-15 minutes

# IP Blocking Test
Same IP makes 50 failed login attempts
- Expected: IP blocked for 1 hour

# Resource Exhaustion Test
- Create 10,000 connections
- Expected: Circuit breaker opens after 5 failures
- Service gracefully degrades

# Large Payload Attack
POST /api/v1/workouts with 10MB payload
- Expected: 413 Payload Too Large (max 1MB)
```

### 2. Load Testing
```
Concurrent Users: 1000
Duration: 5 minutes
Ramp-up: Linear

Endpoints to Test:
- GET /api/v1/athletes/{id}/forecast
- GET /api/v1/workouts/{id}/analysis
- POST /api/v1/times (create time log)
- GET /api/v1/team/dashboard

Expected Results:
- p99 latency: < 500ms
- Error rate: < 0.1%
- Database: Max 80 connections (PgBouncer limit: 100)
```

### 3. Cache Performance
```
- Cache hit ratio: > 90%
- Cache invalidation: < 100ms
- Redis memory: < 256MB (maxmemory limit)
- TTL enforcement: Accurate to ±1s
```

---

## ✅ WORKFLOW TESTING

### Test Journey 1: New Coach Signup → Payment
```
1. Coach clicks "Sign Up"
2. Fills form (name, email, password, team name)
3. Receives verification email
4. Clicks confirmation link
5. Creates first athlete
6. Records first workout
7. Viewing dashboard shows "Upgrade to Pro" CTA
8. Clicks upgrade → Stripe checkout
9. Completes payment (test card 4242 4242 4242 4242)
10. Webhook fires (charge.succeeded)
11. Database subscription created
12. Dashboard updates → Pro features unlocked
✓ Expected: Seamless end-to-end flow
```

### Test Journey 2: Existing User Plan Change
```
1. Coach logged in (on Starter plan)
2. Views Settings → Billing
3. Clicks "Upgrade to Professional"
4. Stripe checkout with proration
5. Completes payment
6. Webhook: subscription.updated
7. New features enabled immediately
✓ Expected: No downtime, prorated correctly
```

### Test Journey 3: Payment Failure & Retry
```
1. Coach initiates checkout
2. Uses failed test card (4000 0000 0000 0002)
3. Payment fails → charge.failed webhook
4. System sends retry email
5. Coach updates payment method
6. Automatic retry succeeds
7. Subscription activated
✓ Expected: Graceful error handling, clear user messaging
```

### Test Journey 4: Canceled Subscription
```
1. Coach on Professional plan
2. Clicks "Cancel Subscription"
3. Selects "Cancel at end of period"
4. Webhook: subscription.updated (cancel_at_period_end=true)
5. Dashboard shows "Cancels on [date]"
6. Period ends → automatic downgrade to Free
7. Pro features disabled
✓ Expected: No surprises, clear timeline
```

### Test Journey 5: Prediction Model Accuracy
```
1. Create athlete with 20+ historical times
2. Request forecast for 200m freestyle
3. Verify prediction within model accuracy (±5%)
4. Check confidence interval (95% CI)
5. Request zone distribution
6. Validate recommendations
✓ Expected: Accurate predictions, explainable output
```

### Test Journey 6: RLS (Row-Level Security)
```
1. Coach A views team A athletes
2. Attempt to query /api/v1/athletes?team_id=team_b
3. Coach B's data never returns
4. Database policy enforces: SELECT * WHERE team_id = $1
✓ Expected: Complete isolation, zero data leakage
```

### Test Journey 7: Concurrent Operations
```
1. 10 coaches simultaneously upload workouts
2. 10 coaches simultaneously request forecasts
3. 10 coaches simultaneously check billing
4. All complete successfully
5. No race conditions, no deadlocks
✓ Expected: System scales under concurrent load
```

---

## 🧪 UNIT TEST EXAMPLES

### Test: Validators
```python
def test_swim_time_validator_valid():
    assert SwimTimeValidator.validate("01'23\"45") == (1, 23, 45)

def test_swim_time_validator_invalid():
    with pytest.raises(ValueError):
        SwimTimeValidator.validate("60'00\"00")  # mm must be 0-59

def test_email_domain_validator_blocks_disposable():
    with pytest.raises(ValueError):
        EmailDomainValidator.validate("user@tempmail.com")

def test_sanitized_str_removes_xss():
    result = SanitizedStr.validate("<script>alert('xss')</script>")
    assert "<script>" not in result
```

### Test: Prediction Model
```python
def test_linear_predictor_accuracy():
    times = [62.5, 62.1, 61.8, 61.5, 61.2]  # Improving trend
    predictor = LinearPredictor(times)
    prediction = predictor.predict(weeks_ahead=4)
    
    assert 60.5 < prediction < 60.9  # Expected range
    assert predictor.r_squared > 0.95

def test_ensemble_confidence_interval():
    ensemble = EnsemblePredictor(times)
    result = ensemble.predict(weeks_ahead=4)
    
    assert result['prediction_seconds'] > result['lower_bound']
    assert result['prediction_seconds'] < result['upper_bound']
    assert result['confidence'] == 0.95
```

### Test: Billing
```python
async def test_create_checkout_session():
    stripe_client = get_stripe_client()
    session = await stripe_client.create_checkout_session(
        customer_id="cus_123",
        price_id="price_starter_eur",
        success_url="https://app.test/success",
        cancel_url="https://app.test/cancel"
    )
    
    assert session['id']
    assert session['url']
    assert session['url'].startswith('https://checkout.stripe.com')

async def test_subscription_status_update_via_webhook():
    event = {
        'type': 'customer.subscription.updated',
        'data': {'object': {'id': 'sub_123', 'status': 'active'}}
    }
    
    await handle_subscription_updated(event['data']['object'], session)
    
    sub = session.scalar(select(Subscription).where(...))
    assert sub.status == SubscriptionStatus.ACTIVE
```

### Test: Caching
```python
async def test_cache_invalidation_pattern():
    # Cache team data
    await cache_team_snapshot("team_123", {"data": "value"})
    
    # Verify cached
    assert await get_team_snapshot("team_123")
    
    # Invalidate pattern
    await invalidate_pattern("aquastats:team:team_123:*")
    
    # Verify cleared
    assert not await get_team_snapshot("team_123")
```

---

## 🔄 CI/CD PIPELINE (GitHub Actions)

### `.github/workflows/tests.yml`
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: aquastats_test
          POSTGRES_PASSWORD: test
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: 3.12
      - run: pip install -r api/requirements.txt pytest pytest-cov
      - run: pytest api/tests --cov=api/src --cov-report=xml
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

### `.github/workflows/security.yml`
```yaml
name: Security
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pip install bandit safety
      - run: bandit -r api/src  # Check for security issues
      - run: safety check  # Check dependencies
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
```

---

## 📈 Test Execution Strategy

### Phase 1: Unit Tests (Week 1)
- All validators: 100% coverage
- All models: 100% coverage  
- Billing logic: 95% coverage
- Prediction models: 90% coverage
- **Target: 85% overall**

### Phase 2: Integration Tests (Week 2)
- API endpoints: All 30 routes
- Database operations: CRUD + RLS
- External services: Stripe, S3, Email
- Caching: Redis patterns
- **Target: All critical paths**

### Phase 3: Security Tests (Week 2)
- OWASP Top 10 penetration
- DDoS simulation
- Authorization bypass attempts
- Encryption validation
- **Target: Zero critical/high vulns**

### Phase 4: Performance Tests (Week 3)
- Load test: 1000 concurrent users
- DDoS simulation: Rate limiting
- Cache efficiency: >90% hit ratio
- Database query optimization
- **Target: p99 latency <500ms**

### Phase 5: Workflow Tests (Week 3)
- End-to-end user journeys
- Payment workflows
- Plan upgrades/downgrades
- Cancellation flows
- **Target: Zero friction points**

---

## 🎯 Success Criteria

- ✅ Code coverage >85%
- ✅ All OWASP Top 10 addressed
- ✅ Zero critical security issues
- ✅ p99 latency <500ms under load
- ✅ 99.9% uptime SLA testable
- ✅ All workflows tested end-to-end
- ✅ CI/CD pipeline passing
- ✅ Production deployment ready

---

## 📦 Dependencies (Test Stack)

```
pytest==8.3.5
pytest-asyncio==0.23.3
pytest-cov==4.1.0
pytest-xdist==3.5.0  # Parallel test execution
hypothesis==6.92.2  # Property-based testing
faker==20.1.0  # Test data generation
requests==2.31.0  # HTTP testing
locust==2.16.1  # Load testing
bandit==1.7.5  # Security linting
safety==2.3.5  # Dependency security
```

---

## 📋 Next Steps

1. **Week 1**: Implement unit tests + CI setup
2. **Week 2**: Integration tests + security scans
3. **Week 3**: Load & performance tests
4. **Week 4**: Workflow testing + final validation

Ready to execute! 🚀

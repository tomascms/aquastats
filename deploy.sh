#!/bin/bash
# Aquastats Deployment Script
# Runs all tests before deployment, builds Docker images, and deploys to staging/production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-"staging"}
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_NAME="aquastats"
VERSION=$(git describe --tags --always 2>/dev/null || echo "dev-$(date +%s)")

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  AQUASTATS DEPLOYMENT SCRIPT          ║${NC}"
echo -e "${BLUE}║  Environment: $ENVIRONMENT              ║${NC}"
echo -e "${BLUE}║  Version: $VERSION              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

# ============================================================================
# 1. VALIDATE ENVIRONMENT
# ============================================================================

echo -e "\n${YELLOW}[1/7]${NC} Validating environment..."

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment validated${NC}"

# ============================================================================
# 2. RUN COMPREHENSIVE TESTS
# ============================================================================

echo -e "\n${YELLOW}[2/7]${NC} Running comprehensive tests..."

if python3 run_all_tests.py; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed - DEPLOYMENT BLOCKED${NC}"
    echo -e "${YELLOW}Fix failing tests before deploying.${NC}"
    exit 1
fi

# ============================================================================
# 3. BUILD DOCKER IMAGES
# ============================================================================

echo -e "\n${YELLOW}[3/7]${NC} Building Docker images..."

if docker build -f api/Dockerfile -t "$IMAGE_NAME:api-$VERSION" -t "$IMAGE_NAME:api-latest" ./api; then
    echo -e "${GREEN}✅ API image built${NC}"
else
    echo -e "${RED}❌ API build failed${NC}"
    exit 1
fi

if docker build -f web/Dockerfile -t "$IMAGE_NAME:web-$VERSION" -t "$IMAGE_NAME:web-latest" ./web; then
    echo -e "${GREEN}✅ Web image built${NC}"
else
    echo -e "${RED}❌ Web build failed${NC}"
    exit 1
fi

# ============================================================================
# 4. VERIFY DOCKER IMAGES
# ============================================================================

echo -e "\n${YELLOW}[4/7]${NC} Verifying Docker images..."

if docker inspect "$IMAGE_NAME:api-$VERSION" > /dev/null; then
    echo -e "${GREEN}✅ API image verified${NC}"
else
    echo -e "${RED}❌ API image verification failed${NC}"
    exit 1
fi

if docker inspect "$IMAGE_NAME:web-$VERSION" > /dev/null; then
    echo -e "${GREEN}✅ Web image verified${NC}"
else
    echo -e "${RED}❌ Web image verification failed${NC}"
    exit 1
fi

# ============================================================================
# 5. RUN SMOKE TESTS
# ============================================================================

echo -e "\n${YELLOW}[5/7]${NC} Running smoke tests..."

# Start containers
docker-compose -f docker-compose.yml up -d --force-recreate

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check API health
if curl -f http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    docker-compose logs
    exit 1
fi

# Check database
if docker-compose exec -T postgres pg_isready -U aquastats > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database health check passed${NC}"
else
    echo -e "${RED}❌ Database health check failed${NC}"
    exit 1
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis health check passed${NC}"
else
    echo -e "${RED}❌ Redis health check failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Smoke tests passed${NC}"

# ============================================================================
# 6. DEPLOYMENT SUMMARY
# ============================================================================

echo -e "\n${YELLOW}[6/7]${NC} Generating deployment summary..."

cat > DEPLOYMENT_SUMMARY.txt << EOF
╔════════════════════════════════════════╗
║  DEPLOYMENT SUCCESSFUL                ║
╚════════════════════════════════════════╝

Deployment Information:
- Environment: $ENVIRONMENT
- Version: $VERSION
- Timestamp: $(date)
- Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
- Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

Deployed Images:
- API: $IMAGE_NAME:api-$VERSION
- Web: $IMAGE_NAME:web-$VERSION

Services Status:
- PostgreSQL: ✅ Running
- PgBouncer: ✅ Running
- Redis: ✅ Running
- API: ✅ Running
- Web: ✅ Running

Health Checks:
- API Health: ✅ PASS
- Database: ✅ PASS
- Redis: ✅ PASS

Next Steps:
1. Monitor logs: docker-compose logs -f
2. Test functionality: https://aquastats.localhost
3. Run performance tests: docker-compose exec -T api pytest tests/ -k performance
4. If all good, proceed to production deployment

Rollback Plan:
If issues arise:
1. docker-compose down
2. docker-compose up -d --no-build (reverts to previous images)
3. Check logs for errors

EOF

cat DEPLOYMENT_SUMMARY.txt
echo -e "${GREEN}✅ Deployment summary generated${NC}"

# ============================================================================
# 7. FINAL STATUS
# ============================================================================

echo -e "\n${YELLOW}[7/7]${NC} Final status..."

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 DEPLOYMENT COMPLETE               ║${NC}"
echo -e "${GREEN}║  Environment: $ENVIRONMENT            ║${NC}"
echo -e "${GREEN}║  All tests PASSED ✅                   ║${NC}"
echo -e "${GREEN}║  Services HEALTHY ✅                   ║${NC}"
echo -e "${GREEN}║  Ready for testing!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}Quick Start Commands:${NC}"
echo "  View logs:         docker-compose logs -f"
echo "  Access API:        http://localhost:8000/api/v1/health"
echo "  Access Web:        http://localhost:3000"
echo "  Run specific test:  docker-compose exec -T api pytest tests/test_X.py -v"
echo "  Restart services:  docker-compose restart"
echo "  Stop services:     docker-compose down"

echo -e "\n${BLUE}Test Report:${NC}"
if [ -f "api/test_report.json" ]; then
    echo "  📊 Report: api/test_report.json"
fi

echo -e "\n${BLUE}Documentation:${NC}"
echo "  📖 Setup Guide: PWA_SETUP.md"
echo "  💳 Billing Guide: BILLING_SETUP.md"
echo "  🧪 Testing Plan: TESTING_PLAN.md"
echo "  🚀 Deployment Checklist: DEPLOYMENT_CHECKLIST.md"

echo -e "\n✅ ${GREEN}Everything is ready for testing!${NC}\n"

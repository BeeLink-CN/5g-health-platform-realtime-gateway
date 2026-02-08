# Staging Deployment & CI Integration

**Priority**: P1-Medium  
**Estimated Effort**: 3-4 hours  
**Depends On**: Ingestion integration verified (#02)

---

## Goal

Deploy gateway to staging environment, configure CI/CD pipeline to run integration tests automatically, and establish "green CI = production-ready" policy.

---

## Background

The gateway has been verified locally and with ingestion integration. Now we need to:
1. Deploy to staging for team/QA testing
2. Automate integration tests in CI
3. Ensure deployment repeatability

---

## Acceptance Criteria

- [ ] Gateway deployed to staging environment
- [ ] GitHub Actions workflow runs integration tests on every PR
- [ ] All 8 verification tests automated in CI
- [ ] Deployment guide tested and documented
- [ ] Health/ready endpoints monitored

---

## Staging Deployment Checklist

### Infrastructure
- [ ] Staging NATS server running with JetStream
- [ ] Create `events` stream with correct subjects
- [ ] Network connectivity verified (gateway → NATS)
- [ ] Ports configured (avoid conflicts): recommend 8080 for staging

### Docker Deployment
- [ ] Build image: `docker build -t 5g-health-gateway:staging .`
- [ ] Push to registry (Docker Hub, ECR, or internal)
- [ ] Update `docker-compose.yml` with staging NATS URL
- [ ] Deploy: `docker-compose up -d`

### Environment Configuration
```yaml
# docker-compose.yml overrides for staging
environment:
  SERVICE_PORT: 8080
  NATS_URL: nats://staging-nats:4222  # Staging NATS hostname
  NATS_STREAM: events
  NATS_DURABLE: realtime-gateway-staging
  CONTRACTS_PATH: /app/contracts
  LOG_LEVEL: info
```

### Verification
- [ ] `curl http://staging-gateway:8080/health` → 200 OK
- [ ] `curl http://staging-gateway:8080/ready` → 200 OK (consumers active)
- [ ] Check logs: schemas loaded, NATS connected
- [ ] Test WebSocket connection with `wscat`

---

## CI Integration Checklist

### GitHub Actions Workflow Enhancements

**Current**: `.github/workflows/integration.yml` runs with NATS container

**Additions Needed**:

#### 1. Add 8 Verification Tests
```yaml
- name: Run Verification Tests
  run: |
    npm run verify:runtime
  env:
    GATEWAY_WS: ws://localhost:8080/ws
    NATS_URL: nats://localhost:4222
```

Create new script: `verify:runtime` that runs all 8 tests sequentially

#### 2. Add Ingestion Integration Test
- [ ] Run ingestion service in CI container
- [ ] Start simulator
- [ ] Verify events flow through gateway
- [ ] Assert no validation errors

#### 3. Add Performance Smoke Test
- [ ] Publish 1000 events rapidly
- [ ] Verify no drops or errors
- [ ] Check latency metrics

#### 4. Branch Protection
- [ ] Require "Integration Tests" workflow to pass before merge
- [ ] Enable auto-merge for dependabot if tests green

---

## Deliverables

### Documentation
1. **Staging deployment guide** (`docs/staging-deployment.md`)
   - Docker commands
   - Environment variables
   - Troubleshooting common issues

2. **CI/CD guide** (`docs/ci-cd.md`)
   - Workflow overview
   - How to add new tests
   - Debugging failed CI runs

### Code
1. **`scripts/verify-runtime.sh`** (or `.ps1`)
   - Runs all 8 verification tests
   - Exits with code 0 if all pass, 1 otherwise

2. **Updated `.github/workflows/integration.yml`**
   - Includes 8 verification tests
   - Ingestion integration (if feasible in CI)
   - Performance smoke test

### Monitoring
1. **Health check endpoint monitored** (Uptime tool, Pingdom, etc.)
2. **Logs aggregated** (CloudWatch, Datadog, or equivalent)
3. **Alerts configured** for service down, validation errors spike

---

## Known Risks

- **NATS not in staging**: May need to provision or use shared dev NATS
  - **Mitigation**: Document NATS setup in staging guide
  
- **CI test flakiness**: Network timeouts, race conditions
  - **Mitigation**: Add retries, increase timeouts, log verbosely
  
- **Docker registry access**: CI needs push/pull permissions
  - **Mitigation**: Configure GitHub secrets for registry credentials

---

## Success Criteria Summary

- ✅ Gateway running in staging, accessible via `http://staging-gateway:8080`
- ✅ CI runs 8 verification tests on every PR
- ✅ All tests passing in CI (green badge)
- ✅ Deployment guide validated by another team member
- ✅ Health endpoint monitored 24/7

---

## References

- [Docker Compose](../../docker-compose.yml)
- [GitHub Actions Workflow](../../.github/workflows/integration.yml)
- [Deployment Summary](../deployment-summary.md)
- [Testing Guide](../testing-guide.md)

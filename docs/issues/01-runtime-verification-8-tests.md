# Runtime Verification - 8 Acceptance Tests

**Priority**: P1-Critical  
**Estimated Effort**: 2-3 hours  
**Depends On**: NATS infrastructure running, gateway startable

---

## Goal

Execute and verify all 8 runtime acceptance tests to confirm gateway behavior matches specification before moving to staging.

---

## Background

The gateway code is complete and builds successfully. All schemas compile. However, runtime verification was blocked by local environment issues (NATS setup, port conflicts). This issue is to complete the 8 verification tests in a stable environment (local with proper NATS, or staging).

---

## Acceptance Criteria

- [ ] All 8 tests pass in sequence
- [ ] No cross-patient data leaks observed
- [ ] Invalid events are rejected (schema validation working)
- [ ] Backpressure handling verified (no crashes under load)
- [ ] Test results documented with evidence (logs, screenshots, curl outputs)

---

## Test Checklist

### Test 1: Health Check Endpoints
- [ ] `GET /health` returns 200 OK with JSON `{"status":"ok"}`
- [ ] `GET /ready` returns 200 when NATS consumers active, 503 otherwise
- [ ] Response headers confirm Fastify (NOT Apache)

### Test 2: WebSocket Handshake
- [ ] Connect to `ws://localhost:808X/ws` succeeds
- [ ] Connection stays alive
- [ ] Ping/pong keepalive works (30s interval)

### Test 3: Subscription Validation (Negative Tests)
- [ ] Global subscription to `vitals.recorded` fails (patient-only event)
- [ ] Error message clear and actionable

### Test 4: Patient-Scoped Subscription
- [ ] Subscribe to patient A for `vitals.recorded`
- [ ] Publish event for patient A → event received
- [ ] Event structure matches spec: `type`, `event_name`, `data`, `received_at`

### Test 5: Cross-Patient Filtering (No Leaks)
- [ ] Client A subscribes to patient 1
- [ ] Client B subscribes to patient 2
- [ ] Publish events for both patients
- [ ] Client A receives ONLY patient 1 events
- [ ] Client B receives ONLY patient 2 events

### Test 6: Global Subscriptions (Dispatch Only)
- [ ] Subscribe with `patient_id: null` to `dispatch.created`
- [ ] Publish dispatch event → received
- [ ] Attempt global subscription to `vitals.recorded` → rejected

### Test 7: Schema Validation Rejection
- [ ] Publish invalid event (bad UUID, missing fields, wrong type)
- [ ] Event NOT delivered to WebSocket clients
- [ ] Gateway logs show "Event failed schema validation - dropped"

### Test 8: Backpressure & Keepalive
- [ ] Simulate slow client (delay acknowledgment)
- [ ] Publish 500 events rapidly
- [ ] Gateway queue reaches limit (200 messages)
- [ ] Oldest messages dropped (logged)
- [ ] Client receives overflow warning
- [ ] Gateway does not crash

---

## Test Environment Options

### Option A: Local (Recommended First)
- Start NATS: `nats-server.exe -js -m 8223`
- Start gateway: Port 8081 (avoid Apache on 8080)
- Use `wscat` or `scripts/smoke-test.js` for WebSocket client

### Option B: Staging
- Deploy gateway to staging environment
- Use remote NATS (already configured in docker-compose.yml)
- Run tests via CI or manual curl + wscat

---

## Deliverables

1. **Test execution log** showing all 8 tests passing
2. **Evidence screenshots** for cross-patient filtering (Test 5)
3. **curl outputs** for health/ready endpoints (Test 1)
4. **Schema rejection logs** (Test 7)
5. **Update README.md** to remove WIP section once all tests pass

---

## Risks

- **NATS not available**: Fallback to staging environment
- **Port conflicts**: Use auto-port selection (`npm run dev:auto`)
- **WebSocket client issues**: Use existing `smoke-test.js` as reference

---

## References

- [Testing Guide](../testing-guide.md) - Detailed test procedures
- [WIP Runtime Testing](../WIP-runtime-testing.md) - Current blockers
- [Integration Checklist](../../brain/integration-checklist.md) - Step-by-step guide

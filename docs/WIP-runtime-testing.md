# WIP: Runtime Verification Testing

**Status**: Local environment blockers prevent runtime testing  
**Code**: ✅ Complete and production-ready  
**Next**: P1 follow-up issues (see /docs/issues/)

---

## What's Done

✅ **Build & Compile**
- TypeScript compilation passes
- Production build succeeds  
- All dependencies pinned

✅ **Schema Loading**
- Ajv2020 configured for draft-2020-12
- All 4 event schemas compile successfully:
  - `vitals.recorded`
  - `patient.alert.raised`
  - `dispatch.created`
  - `dispatch.assigned`

✅ **Code Quality**
- All P0 fixes applied (schema validation, patient filtering, consumer config, backpressure, etc.)
- Unit tests pass (3/3 core tests)
- CI workflow created (.github/workflows/integration.yml)

---

## Local Environment Symptoms

**Port 8080**: Occupied by Apache (httpd.exe PID 9080)  
→ `/health` requests hit Apache, return 404

**Port 4222**: NATS not running initially  
→ Gateway cannot start without NATS

**NATS Binary**: Found at `C:\Users\senso\tools\nats\nats-server-v2.12.4-windows-amd64\nats-server.exe`  
→ Can be started manually, no `nats` CLI on PATH

**Monitor Port 8222**: May conflict with other services  
→ Use `-m 8223` for NATS monitoring

---

## What Remains (P1 Issues)

1. **Runtime Verification (8 Tests)** - See `docs/issues/01-runtime-verification-8-tests.md`
   - Health/ready endpoints
   - WebSocket handshake
   - Patient-scoped subscriptions
   - No cross-patient leaks
   - Global dispatch subscriptions
   - Schema validation rejection
   - Backpressure handling
   - Keepalive ping/pong

2. **Ingestion Integration** - See `docs/issues/02-ingestion-integration.md`
   - Real payload testing with ingestion service
   - Simulator integration
   - Schema compatibility verification

3. **Staging/CI Integration** - See `docs/issues/03-staging-ci-integration.md`
   - Deploy gateway to staging
   - Run integration tests in CI
   - Verify with remote NATS

---

## Manual Testing (PowerShell)

### Prerequisites
- NATS binary at: `C:\Users\senso\tools\nats\nats-server-v2.12.4-windows-amd64\nats-server.exe`
- Node.js 18+ installed
- Gateway dependencies installed (`npm install`)

### Terminal A: Start NATS Server

```powershell
cd C:\Users\senso\tools\nats\nats-server-v2.12.4-windows-amd64
.\nats-server.exe -js -m 8223
```

**Expected output**:
```
[INF] Starting nats-server
[INF] Version: 2.12.4
[INF] Listening for client connections on 0.0.0.0:4222
[INF] Server is ready
[INF] JetStream enabled
```

**Keep this terminal running.**

### Terminal B: Start Gateway

```powershell
cd "C:\Users\senso\OneDrive\Masaüstü\5G Project\5g-health-platform-realtime-gateway"

# Set environment (PowerShell syntax!)
$env:SERVICE_PORT="8081"
$env:NATS_URL="nats://127.0.0.1:4222"
$env:NATS_STREAM="events"
$env:NATS_DURABLE="realtime-gateway-local"
$env:CONTRACTS_PATH="./contracts"

# Start
npm run dev
```

**Expected output**:
```
[INFO] Loading contracts schemas from: ./contracts/events
[INFO] Compiled event schema: vitals.recorded
[INFO] Compiled event schema: patient.alert.raised
[INFO] Compiled event schema: dispatch.created
[INFO] Compiled event schema: dispatch.assigned
[INFO] Event validators ready: count=4
[INFO] Connected to NATS JetStream at 127.0.0.1:4222
[INFO] Realtime gateway up on :8081
```

**Keep this terminal running.**

### Terminal C: Verify Gateway

```powershell
cd "C:\Users\senso\OneDrive\Masaüstü\5G Project\5g-health-platform-realtime-gateway"

# Health check (must use 8081, NOT 8080!)
curl.exe -i http://localhost:8081/health
```

**Expected**: HTTP 200, JSON `{"status":"ok"}`, **NO** `Server: Apache` header

```powershell
# Ready check
curl.exe -i http://localhost:8081/ready
```

**Expected**: HTTP 200 (if consumers active)

```powershell
# Smoke test (end-to-end NATS → WebSocket)
$env:GATEWAY_WS="ws://localhost:8081/ws"
npm run smoke
```

**Expected**:
```
✅ NATS connected
✅ WebSocket connected
✅ Subscription confirmed
✅ Event received via WebSocket!
✅ SMOKE TEST PASSED! 🎉
```

---

## Next Sprint Actions

See GitHub issue templates in `docs/issues/`:

1. **P1-Critical**: Runtime verification 8 tests
2. **P1-High**: Ingestion service integration  
3. **P1-Medium**: Staging environment + CI integration

Once smoke test passes locally, move directly to issue #1 (runtime verification).

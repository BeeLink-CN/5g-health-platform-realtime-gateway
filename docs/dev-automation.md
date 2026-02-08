# Development Automation Scripts

## Quick Start Commands

### Auto-Start with Port Selection
```powershell
# Automatically finds available port (8080-8090) and starts gateway
npm run dev:auto
```

### Manual Start with Environment
```powershell
# Set custom configuration
.\scripts\dev.ps1 -PreferredPort 8081 -NatsDurable "my-consumer"
```

### Local Smoke Test
```powershell
# End-to-end test: publishes to NATS, verifies WebSocket delivery
npm run smoke
```

---

## scripts/dev.ps1

**Purpose**: Eliminate port conflicts and environment setup hassle

**Features**:
- ✅ Auto-detect available port (8080-8090)
- ✅ Check NATS connectivity before start
- ✅ Display all endpoints clearly
- ✅ Set environment variables automatically

**Usage**:
```powershell
# Default (8080, localhost NATS)
.\scripts\dev.ps1

# Custom port
.\scripts\dev.ps1 -PreferredPort 8081

# Remote NATS
.\scripts\dev.ps1 -NatsUrl "nats://remote-server:4222"
```

**Output**:
```
🚀 Starting 5G Real-time Gateway...

✅ Using port: 8081
⚠️  NATS not reachable at localhost:4222
   Gateway will retry connection...

📋 Configuration:
   SERVICE_PORT: 8081
   NATS_URL: nats://localhost:4222
   NATS_STREAM: events
   NATS_DURABLE: realtime-gateway-dev
   CONTRACTS_PATH: ./contracts

🎯 Starting gateway...
   Health: http://localhost:8081/health
   Ready: http://localhost:8081/ready
   WebSocket: ws://localhost:8081/ws
```

---

## scripts/smoke-test.js

**Purpose**: Quick local verification of complete event flow

**Test Flow**:
1. Connect to NATS and Gateway WebSocket
2. Subscribe to `dispatch.created` events
3. Publish test event to NATS
4. Verify event delivered via WebSocket
5. Validate event structure

**Prerequisites**:
- NATS running on localhost:4222
- Gateway running (any port)

**Usage**:
```powershell
# Default (localhost:8080)
npm run smoke

# Custom gateway URL
$env:GATEWAY_WS="ws://localhost:8081/ws"
npm run smoke
```

**Success Output**:
```
🧪 Starting smoke test...

📡 Connecting to NATS...
✅ NATS connected

🔌 Connecting to Gateway WebSocket...
✅ WebSocket connected

📨 Subscribing to dispatch.created...
✅ Subscription confirmed

👂 Listening for events...
📤 Publishing test event to NATS...
✅ Event published to NATS

✅ Event received via WebSocket!
   Event ID: 11111111-1111-1111-1111-111111111111
   Received at: 2026-02-08T18:24:35.123Z

✅ SMOKE TEST PASSED! 🎉
   End-to-end event delivery verified.
```

---

## GitHub Actions Integration Workflow

**File**: `.github/workflows/integration.yml`

**Purpose**: Automated integration testing in CI with real NATS container

**Features**:
- ✅ NATS service container with JetStream
- ✅ Stream creation and verification
- ✅ Gateway startup and health checks
- ✅ WebSocket subscription test
- ✅ Event publication and delivery validation
- ✅ Schema validation rejection test
- ✅ Log artifacts on failure

**Triggers**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Test Steps**:
1. Start NATS container with JetStream
2. Create `events` stream with all 4 subjects
3. Build and start gateway
4. Run health checks (`/health`, `/ready`)
5. WebSocket smoke test (subscribe + publish + verify)
6. Schema validation test (invalid event rejection)

**Viewing Results**:
- GitHub Actions → workflow run → `smoke-test` job
- Download logs if failed

---

## Benefits

### Local Development
- **No more port conflicts**: Auto-finds available port
- **Faster iterations**: One command to start everything
- **Clear feedback**: See exactly what's running where

### CI/CD
- **Catch integration issues early**: NATS + Gateway tested together
- **Confidence in deployments**: End-to-end flow verified
- **Reproducible tests**: Same environment every time

### Team Onboarding
- **Quick start**: `npm run dev:auto` just works
- **Self-documenting**: Scripts show configuration clearly
- **Less tribal knowledge**: Automation handles environment setup

---

## Next Steps

### P1 Enhancements
- [ ] Add NATS stream auto-creation to dev.ps1
- [ ] Support multiple event scenarios in smoke test
- [ ] Add performance smoke test (measure latency)

### P2 Production Features
- [ ] Production smoke test (deployed environment)
- [ ] Load testing script
- [ ] Chaos testing (connection drops, slow consumers)

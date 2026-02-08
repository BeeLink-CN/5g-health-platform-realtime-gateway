# 5G Health Platform - Real-time Gateway

WebSocket gateway for real-time event streaming from NATS JetStream to browser clients.

## Features

- ✅ Patient-scoped and global event subscriptions
- ✅ Schema validation (Ajv2020 with draft-2020-12 support)
- ✅ Backpressure handling with per-client queues
- ✅ Connection health monitoring (ping/pong)
- ✅ At-least-once delivery from NATS JetStream
- ✅ Production-ready with comprehensive testing

## Quick Start

### Prerequisites

- Node.js 18+
- NATS Server with JetStream enabled

### Development

```bash
# Install dependencies
npm install

# Start gateway (auto finds available port, creates stream if needed)
npm run dev:auto

# Run verification (typecheck + build + tests)
npm run verify

# Run smoke test (requires NATS + gateway running)
npm run smoke
```

That's it! The `dev:auto` script will:
- Find an available port (8080-8090)
- Check NATS connectivity
- Auto-create the JetStream stream if missing
- Start the gateway with all endpoints displayed

## Architecture

```
┌─────────────┐    NATS JetStream     ┌──────────────────┐
│  Ingestion  │───────────────────────▶│  Realtime        │
│  Service    │   (4 event types)     │  Gateway         │
└─────────────┘                        └──────────────────┘
                                              │
                                              │ WebSocket
                                              ▼
                                       ┌──────────────┐
                                       │  Browser     │
                                       │  Clients     │
                                       └──────────────┘
```

### Event Types

| Event | Scope | Description |
|-------|-------|-------------|
| `vitals.recorded` | Patient | Vital signs recorded |
| `patient.alert.raised` | Patient | Alert triggered for patient |
| `dispatch.created` | Global | Dispatch created (any patient) |
| `dispatch.assigned` | Global | Dispatch assigned to responder |

## Configuration

Environment variables (see [`.env.example`](.env.example)):

```env
SERVICE_PORT=8080
NATS_URL=nats://localhost:4222
NATS_STREAM=events
NATS_DURABLE=realtime-gateway
CONTRACTS_PATH=./contracts
LOG_LEVEL=info
```

## API Endpoints

### Health Check
```bash
GET /health
# Returns: 200 OK
```

### Readiness Check
```bash
GET /ready
# Returns: 200 if NATS consumers active, 503 otherwise
```

### WebSocket Connection
```bash
ws://localhost:8080/ws
```

#### Subscribe Message
```json
{
  "type": "subscribe",
  "patient_id": "uuid-here",  // or null for global
  "events": ["vitals.recorded", "patient.alert.raised"]
}
```

#### Unsubscribe Message
```json
{
  "type": "unsubscribe",
  "patient_id": "uuid-here"
}
```

#### Event Message (from server)
```json
{
  "type": "event",
  "event_name": "vitals.recorded",
  "data": { /* full event envelope */ },
  "received_at": "2026-02-08T18:30:00.123Z"
}
```

## Testing

### Unit Tests
```bash
npm test
npm run test:watch
```

### Smoke Test (Integration)
```bash
# Start NATS and gateway first
npm run smoke
```

### Full Verification (Pre-PR)
```bash
npm run verify
```

## Docker Deployment

### Build
```bash
docker build -t 5g-health-gateway .
```

### Run with Docker Compose
```bash
# Assumes external NATS on 5g-platform-network
docker-compose up
```

See [`deployment-summary.md`](docs/deployment-summary.md) for production deployment guide.

## Development Scripts

- **`npm run dev:auto`** - Auto-start with port selection and stream creation
- **`npm run smoke`** - End-to-end NATS→WebSocket test
- **`npm run verify`** - Pre-PR verification bundle

See [`dev-automation.md`](docs/dev-automation.md) for detailed automation docs.

## Documentation

- [Testing Guide](docs/testing-guide.md) - 8 verification tests
- [NATS Setup Guide](docs/nats-setup-guide.md) - Infrastructure options
- [Configuration Reference](docs/configuration-reference.md) - All env vars
- [Deployment Summary](docs/deployment-summary.md) - Production checklist
- [Dev Automation](docs/dev-automation.md) - Automation scripts

## Production Considerations

- **At-least-once delivery**: Events may be delivered multiple times (NATS default)
- **Client deduplication**: Clients should dedupe by `event_id`
- **Backpressure**: 200-message queue per client, oldest dropped on overflow
- **Keepalive**: 30s ping interval, connection closed on timeout

See [testing-guide.md](docs/testing-guide.md) for runtime testing procedures.

## CI/CD

GitHub Actions workflow runs integration tests with NATS container on every push/PR.

See [`.github/workflows/integration.yml`](.github/workflows/integration.yml)

## License

MIT

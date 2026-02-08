# 5G Health Platform - Real-time Gateway

Real-time WebSocket gateway delivering NATS JetStream events to dashboard and mobile clients with contract-based validation.

## Overview

This service bridges the gap between the 5G Health Platform's event-driven backend (NATS JetStream) and real-time client applications (dashboards and mobile apps). It consumes platform events and delivers them via WebSocket connections with patient-based filtering and schema validation.

### Key Features

- **WebSocket Server**: Fastify-based WS endpoint for real-time event streaming
- **NATS JetStream Integration**: Durable consumers for reliable event delivery
- **Patient Filtering**: Subscribe to events for specific patients or global events
- **Schema Validation**: AJV-based validation against pinned contract schemas
- **Health Checks**: Comprehensive health and readiness endpoints
- **Graceful Shutdown**: Clean SIGINT/SIGTERM handling

## Architecture

```
┌─────────────────┐
│  NATS JetStream │
│   (Events)      │
└────────┬────────┘
         │
         │ Subscribe
         ▼
┌─────────────────────────────┐
│  Real-time Gateway          │
│                             │
│  ┌─────────────────────┐   │
│  │  NATS Consumer      │   │
│  └──────────┬──────────┘   │
│             │               │
│             ▼               │
│  ┌─────────────────────┐   │
│  │ Schema Validator    │   │
│  └──────────┬──────────┘   │
│             │               │
│             ▼               │
│  ┌─────────────────────┐   │
│  │ Session Manager     │   │
│  └──────────┬──────────┘   │
│             │               │
└─────────────┼───────────────┘
              │
              ▼ WebSocket
     ┌────────────────┐
     │ Client Apps    │
     │ (Dashboard/    │
     │  Mobile)       │
     └────────────────┘
```

## Events

The gateway subscribes to the following NATS subjects:

- `vitals.recorded` - Patient vital signs recorded
- `patient.alert.raised` - Patient alerts/warnings
- `dispatch.created` - New dispatch/ambulance request
- `dispatch.assigned` - Dispatch assigned to resource

## WebSocket Protocol

### Connection

Connect to: `ws://localhost:8080/ws`

Upon connection, you'll receive:
```json
{
  "type": "connected",
  "sessionId": "session-1-1234567890",
  "message": "Connected to 5G Health Platform Real-time Gateway"
}
```

### Subscribe

**Patient-specific events:**
```json
{
  "type": "subscribe",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "events": ["vitals.recorded", "patient.alert.raised"]
}
```

**Global events (e.g., for dispatcher dashboard):**
```json
{
  "type": "subscribe",
  "events": ["dispatch.created", "dispatch.assigned"]
}
```

**Response:**
```json
{
  "type": "subscribed",
  "subscriptionId": "patient-550e8400-e29b-41d4-a716-446655440000",
  "events": ["vitals.recorded", "patient.alert.raised"],
  "patientId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Receive Events

```json
{
  "type": "event",
  "subject": "vitals.recorded",
  "payload": {
    "patient_id": "550e8400-e29b-41d4-a716-446655440000",
    "vital_type": "heart_rate",
    "value": 72,
    "unit": "bpm",
    "timestamp": "2026-02-08T14:30:00Z"
  },
  "timestamp": "2026-02-08T14:30:01Z"
}
```

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Ping/Pong

Keep connection alive:
```json
{ "type": "ping" }
```

Response:
```json
{ "type": "pong", "timestamp": 1707403800000 }
```

## Quick Start

### Prerequisites

- Node.js >= 18
- NATS server with JetStream enabled
- Contracts repository as git submodule

### Setup

1. **Clone and initialize:**
```bash
git clone <repo-url>
cd 5g-health-platform-realtime-gateway

# Add contracts submodule
git submodule add <contracts-repo-url> contracts
git submodule update --init --recursive
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Run with infrastructure:**

Ensure the infra stack is running:
```bash
cd ../5g-health-platform-infra
docker-compose up -d
```

Then start the gateway:
```bash
npm run dev
```

## Running with Docker

### Build image:
```bash
docker build -t 5g-realtime-gateway .
```

### Run with docker-compose:
```bash
# Ensure the external network exists
docker network create 5g-platform-network

# Start the service
docker-compose up -d
```

The service will:
- Connect to NATS at `nats://nats:4222`
- Expose WebSocket endpoint at `http://localhost:8080/ws`
- Provide health checks at `/health` and `/ready`

## Development

### Available scripts:

- `npm run dev` - Start with hot-reload (tsx watch)
- `npm run build` - Compile TypeScript to dist/
- `npm start` - Run compiled code
- `npm test` - Run Jest tests
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint code linting

### Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_PORT` | `8080` | HTTP/WS server port |
| `NODE_ENV` | `development` | Environment mode |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `CONTRACTS_PATH` | `./contracts/schemas` | Path to contract schemas |
| `LOG_LEVEL` | `info` | Logging level (trace, debug, info, warn, error) |

## API Endpoints

### `GET /health`

Health check with dependency status:

```json
{
  "status": "ok",
  "timestamp": "2026-02-08T14:30:00.000Z",
  "dependencies": {
    "nats": {
      "status": "connected"
    }
  },
  "metrics": {
    "activeSessions": 5
  }
}
```

**Status codes:**
- `200` - All dependencies healthy
- `503` - NATS disconnected (degraded)

### `GET /ready`

Readiness probe:

```json
{ "status": "ready" }
```

**Status codes:**
- `200` - Service ready
- `503` - Service not ready

### `GET /metrics`

Operational metrics:

```json
{
  "activeSessions": 5,
  "totalSubscriptions": 12,
  "uptime": 3600.5,
  "memoryUsage": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  }
}
```

## WebSocket Client Example

### Node.js:
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  console.log('Connected');
  
  // Subscribe to patient vitals
  ws.send(JSON.stringify({
    type: 'subscribe',
    patient_id: '550e8400-e29b-41d4-a716-446655440000',
    events: ['vitals.recorded', 'patient.alert.raised']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  if (message.type === 'event') {
    console.log(`Event: ${message.subject}`, message.payload);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Browser JavaScript:
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected');
  
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['dispatch.created', 'dispatch.assigned']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'event') {
    handleEvent(message.subject, message.payload);
  }
};

function handleEvent(subject, payload) {
  console.log(`Event: ${subject}`, payload);
  // Update UI with new data
}
```

## Contracts

The service validates all outbound messages against schemas from the `contracts` repository (added as git submodule). Schemas must be located at:

```
./contracts/schemas/
  ├── vitals-recorded.json
  ├── patient-alert-raised.json
  ├── dispatch-created.json
  └── dispatch-assigned.json
```

If validation fails, the event is logged but not broadcast to clients.

## Troubleshooting

### NATS Connection Failed

**Symptom:** Service starts but shows `NATS disconnected` in health check

**Solutions:**
1. Verify NATS is running: `docker ps | grep nats`
2. Check NATS URL in `.env` matches your setup
3. Ensure JetStream is enabled: `-js` flag in NATS startup

### No Events Received

**Symptom:** WebSocket connects but no events arrive

**Solutions:**
1. Verify NATS stream and consumers exist:
   ```bash
   nats stream ls
   nats consumer ls events
   ```
2. Check if events are being published to NATS:
   ```bash
   nats sub "vitals.recorded"
   ```
3. Review gateway logs for validation errors
4. Ensure subscription message includes correct event types

### Schema Validation Errors

**Symptom:** Logs show "Schema validation failed"

**Solutions:**
1. Verify contracts submodule is initialized:
   ```bash
   git submodule status
   ```
2. Check `CONTRACTS_PATH` points to correct directory
3. Ensure schema files are valid JSON
4. Review event payload structure matches schema

### WebSocket Disconnects

**Symptom:** Client connections drop frequently

**Solutions:**
1. Implement ping/pong heartbeat in client
2. Check network stability
3. Review client-side error handling
4. Increase server resources if under load

### High Memory Usage

**Symptom:** Service memory grows over time

**Solutions:**
1. Check `/metrics` endpoint for session count
2. Ensure clients disconnect properly
3. Monitor subscription count per session
4. Review logs for leaked connections

## CI/CD

GitHub Actions workflow runs on push/PR:

1. **Type Check** - TypeScript compilation
2. **Unit Tests** - Jest test suite
3. **Build** - Production build verification
4. **Docker Build** - Container image build

## Important Runtime Considerations

### At-Least-Once Delivery

The gateway uses **ack-after-processing** semantics with NATS JetStream. If the gateway crashes after sending an event to WebSocket clients but before acknowledging to NATS, JetStream will redeliver the message.

**Implication:** Clients may receive duplicate events.

**Mitigation:**
- Events include `event_id` in the envelope (set by ingestion service)
- Implement client-side deduplication:

```javascript
const seenEvents = new Set();

ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  if (event.type === 'event') {
    const eventId = event.data.event_id;
    if (seenEvents.has(eventId)) {
      console.log('Duplicate event detected, skipping');
      return;
    }
    seenEvents.add(eventId);
    handleEvent(event);
  }
};
```

### JetStream Stream Configuration

The gateway connects to a **single NATS stream** (configurable via `NATS_STREAM`). Verify your stream includes all 4 subjects:

```bash
nats stream info events
```

Required subjects:
- `vitals.recorded`
- `patient.alert.raised`
- `dispatch.created`
- `dispatch.assigned`

**⚠️ Warning:** If subjects are split across multiple streams, the gateway will only consume from the configured stream. Either consolidate subjects into one stream or implement multi-stream support.

## Testing & Verification

See the comprehensive **Testing Guide** for:
- Pre-flight NATS stream verification
- End-to-end smoke tests
- Contract validation testing
- Patient filtering correctness
- Backpressure and keepalive tests
- Common runtime issues and solutions

Run all tests before deploying to staging!

## Production Considerations

### MVP Deployment
1. **TLS/WSS**: Enable secure WebSocket in production
2. **Authentication**: Add JWT-based auth with patient access control
3. **Rate Limiting**: Implement connection/message rate limits per client
4. **Monitoring**: Add Prometheus metrics for events, drops, sessions

### Scaling (Future)
1. **Load Balancing**: Use sticky sessions (session affinity by IP/cookie)
2. **Shared State**: Redis for session store in multi-instance setups
3. **Horizontal Scaling**: Multiple gateway instances behind load balancer
4. **Multi-Stream Support**: Subscribe to subjects across different NATS streams

### Recommended Metrics
- `realtime_events_received_total` - Events consumed from NATS
- `realtime_events_dropped_validation_total` - Events failing schema validation
- `realtime_queue_overflows_total` - Client queue overflows
- `realtime_ws_sessions_active` - Current WebSocket connections
- `realtime_ws_messages_sent_total` - Messages sent to clients

## License

MIT

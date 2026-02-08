# Changelog

All notable changes to the 5G Health Platform Real-time Gateway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-08

### Added
- Real-time WebSocket gateway delivering NATS JetStream events to dashboard and mobile clients
- Contract-driven schema validation with AJV
- Patient-scoped and global event subscriptions
- Backpressure handling with per-client message queues (max 200)
- WebSocket keepalive with ping/pong (30s interval)
- Health check endpoints (`/health`, `/ready`)
- NATS JetStream consumer with durable subscriptions
- Comprehensive logging with Pino
- Docker and docker-compose support

### Fixed
- Schema validation - event_name keying and $ref resolution
- Patient filtering - correct extraction from event payload structure  
- JetStream consumer config - proper consumer opts API usage
- WebSocket protocol - spec-compliant message format (event_name, data, received_at)
- Subscription rules enforcement (global dispatch.* only, patient-scoped filtering)

### Technical
- **Pinned library versions for API compatibility:**
  - `nats@2.15.0` - Consumer opts API compatibility
  - `@fastify/websocket@8.3.1` - SocketStream API compatibility
  - **Upgrade to NATS 2.19+ and @fastify/websocket 10+ tracked as P1 work**
- TypeScript 5.3.3 strict compilation
- Node.js 18+ required
- ESLint + Jest configured

### Security
- Non-root Docker user
- No authentication in MVP (tracked for production)

### Known Limitations
- MVP does not include authentication/authorization
- At-least-once delivery semantics (clients should deduplicate by event_id)
- Single NATS stream support (multi-stream tracked as P1)

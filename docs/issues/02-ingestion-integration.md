# Ingestion Service Integration

**Priority**: P1-High  
**Estimated Effort**: 4-6 hours  
**Depends On**: Runtime verification tests passing (#01)

---

## Goal

Integrate gateway with the ingestion service and verify that real payloads from sensors/simulators flow correctly through the entire pipeline: Ingestion → NATS → Gateway → WebSocket clients.

---

## Background

The gateway has been tested with synthetic events (smoke test). Now we need to verify compatibility with actual events published by the ingestion service, ensuring schema alignment, patient filtering, and end-to-end delivery.

---

## Acceptance Criteria

- [ ] Gateway receives events from ingestion service via NATS
- [ ] All event schemas match (no validation failures)
- [ ] Patient-scoped filtering works with real patient IDs
- [ ] WebSocket clients receive real-time updates
- [ ] No data loss or duplication observed
- [ ] Performance acceptable (latency < 100ms p95)

---

## Integration Checklist

### Infrastructure Setup
- [ ] NATS JetStream running with `events` stream
- [ ] Ingestion service configured to publish to NATS
- [ ] Gateway configured to same NATS URL
- [ ] Stream subjects match: `vitals.recorded`, `patient.alert.raised`, `dispatch.created`, `dispatch.assigned`

### Test Scenarios

#### Scenario 1: Vital Signs Flow
- [ ] Start simulator publishing vital signs for patient A
- [ ] Start ingestion service (consumes from MQTT, publishes to NATS)
- [ ] Connect WebSocket client to gateway, subscribe to patient A
- [ ] **Verify**: Client receives vital signs events in real-time
- [ ] **Check**: `event_name`, `patient_id`, `timestamp`, vital values all present

#### Scenario 2: Patient Alerts
- [ ] Trigger alert condition in simulator (e.g., high heart rate)
- [ ] **Verify**: `patient.alert.raised` event delivered to subscribed clients
- [ ] **Check**: Alert payload matches contract schema

#### Scenario 3: Dispatch Events
- [ ] Create dispatch via ingestion service API (if available) or publish manually
- [ ] Connect WebSocket client with `patient_id: null` (global subscription)
- [ ] **Verify**: `dispatch.created` and `dispatch.assigned` events received
- [ ] **Check**: No patient-scoped clients receive dispatch events

#### Scenario 4: Multi-Patient Isolation
- [ ] Run simulator for patients A, B, C simultaneously
- [ ] Connect 3 WebSocket clients, each subscribed to one patient
- [ ] **Verify**: Each client receives ONLY their patient's events
- [ ] **Check**: No cross-patient leaks

#### Scenario 5: Schema Compatibility
- [ ] Review ingestion service event publishing code
- [ ] Compare published event structure with gateway contracts
- [ ] **Verify**: All required fields present
- [ ] **Check**: No unexpected validation errors in gateway logs

### Performance Testing
- [ ] Run simulator at 10 events/second for 10 minutes
- [ ] Monitor gateway metrics:
  - Events received from NATS
  - Events validated
  - Events delivered to WebSocket
  - Drop count (should be 0)
  - Queue overflow (should be 0)
- [ ] Measure end-to-end latency (NATS publish → WebSocket delivery)

---

## Deliverables

1. **Integration test report** with pass/fail for each scenario
2. **Performance metrics** (throughput, latency p50/p95/p99)
3. **Schema compatibility matrix** (ingestion vs. contracts)
4. **Any schema fixes** required in ingestion or contracts repos
5. **Updated deployment guide** with ingestion integration steps

---

## Known Risks

- **Schema mismatches**: Ingestion may publish fields not in contracts (or vice versa)
  - **Mitigation**: Review both codebases before testing
  
- **NATS stream misconfiguration**: Subject names may differ
  - **Mitigation**: Verify with `nats stream info events` (if CLI available)
  
- **Performance bottlenecks**: High event volume may reveal issues
  - **Mitigation**: Start with low throughput, gradually increase

---

## Success Criteria Summary

- ✅ 100% of ingestion events pass schema validation
- ✅ Patient filtering works correctly (no cross-leaks)
- ✅ End-to-end latency < 100ms (p95)
- ✅ No events dropped under normal load (< 100 events/sec)
- ✅ Deployment guide updated with integration steps

---

## References

- [Ingestion Service Repo](https://github.com/user/5g-health-platform-ingestion)
- [Contracts Repo](https://github.com/user/5g-health-platform-contracts)
- [Testing Guide](../testing-guide.md)
- [NATS Setup Guide](../nats-setup-guide.md)

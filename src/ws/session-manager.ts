import { SocketStream } from '@fastify/websocket';
import { logger } from '../utils/logger';

const MAX_QUEUE = 200;

type EventName =
    | 'vitals.recorded'
    | 'patient.alert.raised'
    | 'dispatch.created'
    | 'dispatch.assigned';

export interface Subscription {
    patientId: string | null; // null => global
    events: Set<EventName>;
}

export interface ClientSession {
    id: string;
    socket: SocketStream;
    subscriptions: Map<string, Subscription>; // key: "global" or "patient:<uuid>"
    queue: string[];
    flushScheduled: boolean;
    isAlive: boolean;
    lastOverflowNoticeAt: number;
}

function extractPatientId(eventName: EventName, event: any): string | null {
    switch (eventName) {
        case 'vitals.recorded':
            return event?.payload?.patient_id ?? null;
        case 'patient.alert.raised':
            return event?.payload?.alert?.patient_id ?? null;
        case 'dispatch.created':
            return event?.payload?.dispatch?.patient_id ?? null;
        case 'dispatch.assigned':
            return null; // contract has no patient_id
        default:
            return null;
    }
}

export class SessionManager {
    private sessions: Map<string, ClientSession> = new Map();
    private counter = 0;

    addSession(socket: SocketStream): string {
        const id = `session-${++this.counter}-${Date.now()}`;
        this.sessions.set(id, {
            id,
            socket,
            subscriptions: new Map(),
            queue: [],
            flushScheduled: false,
            isAlive: true,
            lastOverflowNoticeAt: 0,
        });
        logger.info({ id }, 'Client connected');
        return id;
    }

    removeSession(id: string): void {
        this.sessions.delete(id);
        logger.info({ id }, 'Client disconnected');
    }

    getSession(id: string): ClientSession | undefined {
        return this.sessions.get(id);
    }

    getSessionCount(): number {
        return this.sessions.size;
    }

    getAllSessions(): ClientSession[] {
        return Array.from(this.sessions.values());
    }

    private enqueue(session: ClientSession, msgObj: unknown): void {
        const msg = JSON.stringify(msgObj);

        if (session.queue.length >= MAX_QUEUE) {
            // Drop oldest
            session.queue.shift();

            // Throttle overflow notices to avoid spamming
            const now = Date.now();
            if (now - session.lastOverflowNoticeAt > 3000) {
                session.lastOverflowNoticeAt = now;
                session.queue.push(
                    JSON.stringify({
                        type: 'notice',
                        message: 'client queue overflow, dropping messages',
                    })
                );
            }
        }

        session.queue.push(msg);

        if (!session.flushScheduled) {
            session.flushScheduled = true;
            setImmediate(() => this.flush(session.id));
        }
    }

    private flush(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.flushScheduled = false;

        while (session.queue.length > 0) {
            const msg = session.queue.shift()!;
            try {
                session.socket.socket.send(msg);
            } catch (err) {
                logger.error({ sessionId, err }, 'Send failed; dropping session');
                try {
                    session.socket.socket.terminate();
                } catch { }
                this.removeSession(sessionId);
                return;
            }
        }
    }

    upsertSubscription(sessionId: string, patientId: string | null, events: EventName[]): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const key = patientId ? `patient:${patientId}` : 'global';
        const existing = session.subscriptions.get(key);

        if (existing) {
            for (const e of events) existing.events.add(e);
        } else {
            session.subscriptions.set(key, {
                patientId,
                events: new Set(events),
            });
        }

        logger.info({ sessionId, key, events }, 'Subscribed');
    }

    removeFromSubscription(sessionId: string, patientId: string | null, events: EventName[]): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const key = patientId ? `patient:${patientId}` : 'global';
        const sub = session.subscriptions.get(key);
        if (!sub) return;

        for (const e of events) sub.events.delete(e);
        if (sub.events.size === 0) session.subscriptions.delete(key);

        logger.info({ sessionId, key, events }, 'Unsubscribed');
    }

    broadcast(eventName: EventName, event: any): void {
        const patientId = extractPatientId(eventName, event);

        for (const session of this.sessions.values()) {
            for (const sub of session.subscriptions.values()) {
                if (!sub.events.has(eventName)) continue;

                // GLOBAL: allow dispatch.* only
                if (sub.patientId === null) {
                    if (!eventName.startsWith('dispatch.')) continue;
                    // dispatch.assigned has no patientId, dispatch.created may have one; both ok for global.
                } else {
                    // PATIENT scoped: require match
                    if (!patientId || patientId !== sub.patientId) continue;
                    // and dispatch.assigned is never patient-scoped
                    if (eventName === 'dispatch.assigned') continue;
                }

                this.enqueue(session, {
                    type: 'event',
                    event_name: event?.event_name ?? eventName,
                    data: event, // unchanged event envelope
                    received_at: new Date().toISOString(),
                });
            }
        }
    }
}

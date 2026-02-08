import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { SessionManager } from './session-manager';
import { logger } from '../utils/logger';

type EventName =
    | 'vitals.recorded'
    | 'patient.alert.raised'
    | 'dispatch.created'
    | 'dispatch.assigned';

const ALL_EVENTS: Set<EventName> = new Set([
    'vitals.recorded',
    'patient.alert.raised',
    'dispatch.created',
    'dispatch.assigned',
]);

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WSInbound =
    | { type: 'subscribe'; patient_id: string | null; events: EventName[] }
    | { type: 'unsubscribe'; patient_id: string | null; events: EventName[] }
    | { type: 'ping' };

export const createWebSocketPlugin = (sessions: SessionManager): FastifyPluginAsync => {
    return async (fastify: FastifyInstance) => {
        await fastify.register(fastifyWebsocket);

        // Keepalive ping every 30s
        const interval = setInterval(() => {
            for (const s of sessions.getAllSessions()) {
                if (!s.isAlive) {
                    try { s.socket.socket.terminate(); } catch { }
                    sessions.removeSession(s.id);
                    continue;
                }
                s.isAlive = false;
                try { s.socket.socket.ping(); } catch { }
            }
        }, 30_000);

        fastify.addHook('onClose', async () => clearInterval(interval));

        fastify.get('/ws', { websocket: true }, (socket) => {
            const sessionId = sessions.addSession(socket);

            socket.socket.on('pong', () => {
                const s = sessions.getSession(sessionId);
                if (s) s.isAlive = true;
            });

            socket.socket.send(
                JSON.stringify({
                    type: 'connected',
                    session_id: sessionId,
                    message: 'Connected to 5G Health Platform Real-time Gateway',
                })
            );

            socket.socket.on('message', (raw: Buffer) => {
                let msg: WSInbound;
                try {
                    msg = JSON.parse(raw.toString());
                } catch {
                    socket.socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                    return;
                }

                if (msg.type === 'ping') {
                    socket.socket.send(JSON.stringify({ type: 'pong', received_at: new Date().toISOString() }));
                    return;
                }

                // Basic validation
                if (!Array.isArray((msg as any).events) || (msg as any).events.length === 0) {
                    socket.socket.send(JSON.stringify({ type: 'error', message: 'events is required' }));
                    return;
                }

                const events = (msg as any).events.filter((e: any) => ALL_EVENTS.has(e));
                if (events.length === 0) {
                    socket.socket.send(JSON.stringify({ type: 'error', message: 'No valid events requested' }));
                    return;
                }

                const patientId = (msg as any).patient_id ?? null;
                if (patientId !== null && !UUID_RE.test(patientId)) {
                    socket.socket.send(JSON.stringify({ type: 'error', message: 'patient_id must be UUID or null' }));
                    return;
                }

                // Enforce global rules:
                // - patient_id null => ONLY dispatch.* allowed
                // - patient_id set => dispatch.assigned not allowed (no patient_id in contract)
                if (patientId === null) {
                    const invalid = events.filter((e: EventName) => !e.startsWith('dispatch.'));
                    if (invalid.length) {
                        socket.socket.send(JSON.stringify({
                            type: 'error',
                            message: 'global subscriptions (patient_id=null) may only include dispatch.* events',
                            invalid,
                        }));
                        return;
                    }
                } else {
                    if (events.includes('dispatch.assigned')) {
                        socket.socket.send(JSON.stringify({
                            type: 'error',
                            message: 'dispatch.assigned is GLOBAL only in MVP (no patient_id in current contract)',
                        }));
                        return;
                    }
                }

                if (msg.type === 'subscribe') {
                    sessions.upsertSubscription(sessionId, patientId, events);
                    socket.socket.send(JSON.stringify({
                        type: 'subscribed',
                        patient_id: patientId,
                        events,
                    }));
                } else if (msg.type === 'unsubscribe') {
                    sessions.removeFromSubscription(sessionId, patientId, events);
                    socket.socket.send(JSON.stringify({
                        type: 'unsubscribed',
                        patient_id: patientId,
                        events,
                    }));
                } else {
                    socket.socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
                }
            });

            socket.socket.on('close', () => sessions.removeSession(sessionId));
            socket.socket.on('error', (err: any) => {
                logger.error({ sessionId, err }, 'WebSocket error');
                sessions.removeSession(sessionId);
            });
        });
    };
};

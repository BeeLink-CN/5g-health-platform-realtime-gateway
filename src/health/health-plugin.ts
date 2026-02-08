import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { NatsService } from '../nats/service';
import { SessionManager } from '../ws/session-manager';

export const createHealthPlugin = (
    nats: NatsService,
    sessions: SessionManager
): FastifyPluginAsync => {
    return async (fastify: FastifyInstance) => {
        fastify.get('/health', async (_req, reply) => {
            const ok = nats.isConnected();
            const consuming = nats.isConsuming();

            const body = {
                status: ok && consuming ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                dependencies: {
                    nats: { connected: ok, consuming },
                },
                metrics: {
                    activeSessions: sessions.getSessionCount(),
                },
            };

            reply.code(body.status === 'ok' ? 200 : 503).send(body);
        });

        fastify.get('/ready', async (_req, reply) => {
            if (nats.isConnected() && nats.isConsuming()) {
                reply.code(200).send({ status: 'ready' });
            } else {
                reply.code(503).send({ status: 'not ready' });
            }
        });
    };
};

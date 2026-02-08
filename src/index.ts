import Fastify from 'fastify';
import { config } from './config';
import { NatsService } from './nats/service';
import { SchemaValidator } from './validation/schema-validator';
import { SessionManager } from './ws/session-manager';
import { createWebSocketPlugin } from './ws/websocket-plugin';
import { createHealthPlugin } from './health/health-plugin';

const SUBJECTS = [
    'vitals.recorded',
    'patient.alert.raised',
    'dispatch.created',
    'dispatch.assigned',
] as const;

async function main() {
    const nats = new NatsService();
    const validator = new SchemaValidator();
    const sessions = new SessionManager();

    const fastify = Fastify({
        logger: {
            level: config.logging.level,
            transport:
                config.service.env === 'development'
                    ? {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            translateTime: 'HH:MM:ss Z',
                            ignore: 'pid,hostname',
                        },
                    }
                    : undefined,
        },
    });

    await fastify.register(createHealthPlugin(nats, sessions));
    await fastify.register(createWebSocketPlugin(sessions));

    const shutdown = async (signal: string) => {
        fastify.log.info({ signal }, 'Shutting down...');
        try {
            await fastify.close();
            await nats.disconnect();
            process.exit(0);
        } catch (err: any) {
            fastify.log.error({ err }, 'Shutdown failed');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    await validator.loadSchemas();
    await nats.connect();

    await nats.subscribeToEvents([...SUBJECTS], async (subject, data) => {
        // subject is the event_name in our contract model
        const ok = validator.validate(subject, data);
        if (!ok) return;
        sessions.broadcast(subject, data);
    });

    await fastify.listen({ port: config.service.port, host: '0.0.0.0' });
    fastify.log.info({ port: config.service.port }, 'Realtime gateway up');
}

void main();

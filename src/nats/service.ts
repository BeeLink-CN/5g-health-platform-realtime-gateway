import { connect, NatsConnection, JetStreamClient, consumerOpts, JetStreamManager, StorageType, RetentionPolicy, DiscardPolicy } from 'nats';
import { logger } from '../utils/logger';
import { config } from '../config';

type EventName =
    | 'vitals.recorded'
    | 'patient.alert.raised'
    | 'dispatch.created'
    | 'dispatch.assigned';

export class NatsService {
    private nc: NatsConnection | null = null;
    private js: JetStreamClient | null = null;
    private jsm: JetStreamManager | null = null;
    private consuming = false;

    async connect(): Promise<void> {
        const maxRetries = 10;
        const baseDelay = 1000; // 1 second

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info({ url: config.nats.url, attempt, maxRetries }, 'Connecting to NATS...');

                this.nc = await connect({
                    servers: config.nats.url,
                    name: '5g-health-platform-realtime-gateway',
                    maxReconnectAttempts: -1,
                    reconnectTimeWait: 1000,
                    timeout: 5000, // 5 second connection timeout
                });

                this.js = this.nc.jetstream();
                this.jsm = await this.nc.jetstreamManager();

                (async () => {
                    if (!this.nc) return;
                    for await (const s of this.nc.status()) {
                        logger.info({ status: s.type, data: s.data }, 'NATS status');
                    }
                })();

                logger.info('Connected to NATS JetStream');

                // Ensure stream exists (create if missing)
                await this.ensureStream();
                return; // Success!

            } catch (err: any) {
                logger.warn({
                    err: err.message,
                    attempt,
                    maxRetries,
                    nextRetryIn: attempt < maxRetries ? baseDelay * Math.pow(2, attempt - 1) : null
                }, 'NATS connection failed, retrying...');

                if (attempt === maxRetries) {
                    logger.error({ err }, 'Failed to connect to NATS after maximum retries');
                    throw new Error(`NATS connection failed after ${maxRetries} attempts: ${err.message}`);
                }

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s...
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    private async ensureStream(): Promise<void> {
        if (!this.jsm) throw new Error('JetStream Manager not initialized');

        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const info = await this.jsm.streams.info(config.nats.stream);
                logger.info({ stream: config.nats.stream, subjects: info.config.subjects }, 'JetStream stream found');
                return;
            } catch {
                try {
                    logger.info({ stream: config.nats.stream, attempt }, 'JetStream stream not found, creating...');
                    await this.jsm.streams.add({
                        name: config.nats.stream,
                        subjects: [
                            'vitals.recorded',
                            'patient.alert.raised',
                            'dispatch.created',
                            'dispatch.assigned',
                        ],
                        storage: StorageType.Memory,
                        retention: RetentionPolicy.Limits,
                        discard: DiscardPolicy.Old,
                        max_msgs: -1,
                        max_age: 0,
                        max_bytes: -1,
                        num_replicas: 1,
                    });
                    logger.info({ stream: config.nats.stream }, 'JetStream stream created');
                    return;
                } catch (err: any) {
                    if (attempt === maxRetries) {
                        logger.error({ err }, 'Failed to create JetStream stream after retries');
                        throw err;
                    }
                    logger.warn({ err: err.message, attempt }, 'Stream creation failed, retrying...');
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
    }

    isConnected(): boolean {
        return this.nc !== null && !this.nc.isClosed();
    }

    isConsuming(): boolean {
        return this.consuming;
    }

    async disconnect(): Promise<void> {
        if (this.nc) await this.nc.close();
        this.nc = null;
        this.js = null;
        this.jsm = null;
        this.consuming = false;
        logger.info('Disconnected from NATS');
    }

    async subscribeToEvents(
        subjects: EventName[],
        onEvent: (subject: EventName, data: any) => Promise<void> | void
    ): Promise<void> {
        if (!this.js || !this.jsm) throw new Error('NATS not connected');

        for (const subject of subjects) {
            const durable = `${config.nats.durableBase}-${subject.replace(/\./g, '-')}`;

            const opts = consumerOpts();
            opts.durable(durable);
            opts.manualAck();
            opts.ackExplicit();
            opts.deliverNew();
            opts.ackWait(30_000);
            // Push consumer requires a deliver subject - use unique inbox for each consumer
            opts.deliverTo(`_INBOX.${durable}`);

            const sub = await this.js.subscribe(subject, opts);

            (async () => {
                for await (const m of sub) {
                    try {
                        const data = JSON.parse(m.data.toString());
                        await onEvent(subject, data);
                        m.ack();
                    } catch (err: any) {
                        logger.error({ subject, err }, 'Failed processing message; nak');
                        try { m.nak(); } catch { }
                    }
                }
            })();

            logger.info({ subject, stream: config.nats.stream, durable }, 'Subscribed');
        }

        this.consuming = true;
    }
}

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
        logger.info({ url: config.nats.url }, 'Connecting to NATS...');
        this.nc = await connect({
            servers: config.nats.url,
            name: '5g-health-platform-realtime-gateway',
            maxReconnectAttempts: -1,
            reconnectTimeWait: 1000,
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
    }

    private async ensureStream(): Promise<void> {
        if (!this.jsm) throw new Error('JetStream Manager not initialized');

        try {
            const info = await this.jsm.streams.info(config.nats.stream);
            logger.info({ stream: config.nats.stream, subjects: info.config.subjects }, 'JetStream stream found');
        } catch {
            logger.info({ stream: config.nats.stream }, 'JetStream stream not found, creating...');
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
                max_msgs: -1, // Unlimited messages
                max_age: 0, // No age limit
                max_bytes: -1, // Unlimited bytes
                num_replicas: 1,
            });
            logger.info({ stream: config.nats.stream }, 'JetStream stream created');
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

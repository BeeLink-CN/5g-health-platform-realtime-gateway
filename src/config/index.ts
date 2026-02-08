import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
    service: {
        port: number;
        env: string;
    };
    nats: {
        url: string;
        stream: string;
        durableBase: string;
    };
    contracts: {
        path: string;
    };
    logging: {
        level: string;
    };
}

function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value ?? defaultValue!;
}

export const config: Config = {
    service: {
        port: parseInt(getEnv('SERVICE_PORT', '8080'), 10),
        env: getEnv('NODE_ENV', 'development'),
    },
    nats: {
        url: getEnv('NATS_URL', 'nats://localhost:4222'),
        stream: getEnv('NATS_STREAM', 'events'),
        durableBase: getEnv('NATS_DURABLE', 'realtime-gateway'),
    },
    contracts: {
        path: path.resolve(getEnv('CONTRACTS_PATH', './contracts/schemas')),
    },
    logging: {
        level: getEnv('LOG_LEVEL', 'info'),
    },
};

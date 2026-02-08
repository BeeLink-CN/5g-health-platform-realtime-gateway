import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { logger } from '../utils/logger';
import { config } from '../config';

type EventName =
    | 'vitals.recorded'
    | 'patient.alert.raised'
    | 'dispatch.created'
    | 'dispatch.assigned';

const EVENT_SCHEMA_PATHS: Record<EventName, string> = {
    'vitals.recorded': 'events/vitals-recorded.json',
    'patient.alert.raised': 'events/patient-alert-raised.json',
    'dispatch.created': 'events/dispatch-created.json',
    'dispatch.assigned': 'events/dispatch-assigned.json',
};

function sha256(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
}

export class SchemaValidator {
    private ajv: Ajv2020;
    private validators: Map<EventName, ValidateFunction> = new Map();

    constructor() {
        // Ajv2020 enables draft 2020-12 features/meta-schema handling.
        this.ajv = new Ajv2020({
            allErrors: true,
            strict: true,
            validateSchema: false,  // Skip meta-schema validation for MVP
            addUsedSchema: false,
        });

        addFormats(this.ajv);
    }

    private getAllSchemaFiles(dir: string, out: string[] = []): string[] {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) this.getAllSchemaFiles(full, out);
            else if (entry.name.endsWith('.json')) out.push(full);
        }
        return out;
    }

    async loadSchemas(): Promise<void> {
        const root = config.contracts.path;

        if (!fs.existsSync(root)) {
            throw new Error(
                `Contracts path not found: ${root}. Set CONTRACTS_PATH to the contracts root (containing events/ and domain/).`
            );
        }

        logger.info({ root }, 'Loading contracts schemas into AJV registry...');

        // 1) Load + register ALL schemas first (so $refs resolve), but dedupe by $id.
        const files = this.getAllSchemaFiles(root);

        // Track $id -> { file, hash } so we can detect true conflicts
        const seen = new Map<string, { file: string; hash: string }>();

        for (const file of files) {
            const raw = fs.readFileSync(file, 'utf-8');
            const hash = sha256(raw);
            const schema = JSON.parse(raw);

            if (!schema.$id) {
                throw new Error(`Missing $id in schema: ${path.relative(root, file)}`);
            }

            const id: string = schema.$id;

            const prev = seen.get(id);
            if (prev) {
                if (prev.hash !== hash) {
                    // Same $id, different content -> contracts repo problem (must be fixed)
                    throw new Error(
                        `Duplicate $id with different content:\n` +
                        `  $id: ${id}\n` +
                        `  first: ${path.relative(root, prev.file)}\n` +
                        `  second: ${path.relative(root, file)}\n`
                    );
                }
                // Same $id, same content -> ignore duplicate safely
                logger.warn(
                    { id, file: path.relative(root, file), firstSeen: path.relative(root, prev.file) },
                    'Duplicate schema $id found (identical content) - skipping re-registration'
                );
                continue;
            }

            // Avoid "schema already exists" even if AJV already has it (defensive)
            if (!this.ajv.getSchema(id)) {
                this.ajv.addSchema(schema, id);
            }

            seen.set(id, { file, hash });
        }

        // 2) Compile the 4 event schemas and key by event_name
        for (const [eventName, relPath] of Object.entries(EVENT_SCHEMA_PATHS) as [EventName, string][]) {
            const fullPath = path.join(root, relPath);

            if (!fs.existsSync(fullPath)) {
                throw new Error(
                    `Event schema missing for ${eventName}: ${path.relative(root, fullPath)}`
                );
            }

            const raw = fs.readFileSync(fullPath, 'utf-8');
            const schema = JSON.parse(raw);

            if (!schema.$id) {
                throw new Error(`Missing $id in event schema: ${relPath}`);
            }

            // It should already be in registry from step (1), but keep this safe:
            if (!this.ajv.getSchema(schema.$id)) {
                this.ajv.addSchema(schema, schema.$id);
            }

            const validate = this.ajv.compile(schema);
            this.validators.set(eventName, validate);

            logger.info({ eventName, schema: relPath, schemaId: schema.$id }, 'Compiled event schema');
        }

        logger.info({ count: this.validators.size }, 'Event validators ready');
    }

    validate(eventName: EventName, data: unknown): boolean {
        const v = this.validators.get(eventName);
        if (!v) {
            logger.error({ eventName }, 'Validator missing for event - refusing to send');
            return false;
        }

        const ok = v(data);
        if (!ok) {
            logger.error({ eventName, errors: v.errors }, 'Event failed schema validation - dropped');
        }
        return !!ok;
    }

    hasSchema(eventName: string): boolean {
        return this.validators.has(eventName as EventName);
    }

    getSchemaCount(): number {
        return this.validators.size;
    }
}

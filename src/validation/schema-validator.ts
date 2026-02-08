import fs from 'fs';
import path from 'path';
import Ajv, { ValidateFunction } from 'ajv';
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

export class SchemaValidator {
    private ajv: Ajv;
    private validators: Map<EventName, ValidateFunction> = new Map();

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            strict: false,  // Allow draft-2020-12 and other meta-schemas
            validateSchema: false,  // Skip meta-schema validation
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
                `Contracts path not found: ${root}. Add contracts submodule and set CONTRACTS_PATH correctly.`
            );
        }

        logger.info({ root }, 'Loading contracts schemas into AJV registry...');

        // 1) Load + add ALL schemas first (so $refs resolve)
        const files = this.getAllSchemaFiles(root);
        logger.info({ count: files.length }, 'Found schema files');

        for (const file of files) {
            const raw = fs.readFileSync(file, 'utf-8');
            const schema = JSON.parse(raw);

            if (!schema.$id) {
                throw new Error(`Missing $id in schema: ${path.relative(root, file)}`);
            }

            try {
                this.ajv.addSchema(schema, schema.$id);
                logger.info({ schemaId: schema.$id, file: path.relative(root, file) }, 'Loaded schema');
            } catch (err) {
                logger.error({ schemaId: schema.$id, file: path.relative(root, file), err }, 'Failed to add schema');
                throw err;
            }
        }

        // 2) Compile the four event schemas and key by event_name
        for (const [eventName, relPath] of Object.entries(EVENT_SCHEMA_PATHS) as [EventName, string][]) {
            const fullPath = path.join(root, relPath);
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const schema = JSON.parse(raw);

            // Schema already in registry from step 1, just compile it
            const validate = this.ajv.compile(schema);
            this.validators.set(eventName, validate);
            logger.info({ eventName, schema: relPath }, 'Compiled event schema');
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

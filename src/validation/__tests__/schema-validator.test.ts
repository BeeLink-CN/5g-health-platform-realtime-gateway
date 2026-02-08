import { SchemaValidator } from '../schema-validator';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SchemaValidator', () => {
    let validator: SchemaValidator;

    beforeEach(() => {
        validator = new SchemaValidator();
        jest.clearAllMocks();
    });

    describe('validate', () => {
        it('should return true when no schema is defined (permissive)', () => {
            const result = validator.validate('unknown.event', { foo: 'bar' });
            expect(result).toBe(true);
        });

        it('should validate correct data against schema', async () => {
            const schema = {
                type: 'object',
                properties: {
                    patient_id: { type: 'string', format: 'uuid' },
                    value: { type: 'number' },
                },
                required: ['patient_id', 'value'],
            };

            // Manually add schema for testing
            const ajv = (validator as any).ajv;
            const compiledSchema = ajv.compile(schema);
            (validator as any).validators.set('vitals.recorded', compiledSchema);

            const validData = {
                patient_id: '123e4567-e89b-12d3-a456-426614174000',
                value: 120,
            };

            const result = validator.validate('vitals.recorded', validData);
            expect(result).toBe(true);
        });

        it('should return false for invalid data', async () => {
            const schema = {
                type: 'object',
                properties: {
                    patient_id: { type: 'string', format: 'uuid' },
                    value: { type: 'number' },
                },
                required: ['patient_id', 'value'],
            };

            const ajv = (validator as any).ajv;
            const compiledSchema = ajv.compile(schema);
            (validator as any).validators.set('vitals.recorded', compiledSchema);

            const invalidData = {
                patient_id: 'not-a-uuid',
                value: 'not-a-number',
            };

            const result = validator.validate('vitals.recorded', invalidData);
            expect(result).toBe(false);
        });
    });

    describe('hasSchema', () => {
        it('should return false when schema does not exist', () => {
            expect(validator.hasSchema('unknown.event')).toBe(false);
        });

        it('should return true when schema exists', () => {
            const schema = { type: 'object' };
            const ajv = (validator as any).ajv;
            const compiledSchema = ajv.compile(schema);
            (validator as any).validators.set('test.event', compiledSchema);

            expect(validator.hasSchema('test.event')).toBe(true);
        });
    });

    describe('getSchemaCount', () => {
        it('should return 0 when no schemas loaded', () => {
            expect(validator.getSchemaCount()).toBe(0);
        });

        it('should return correct count after loading schemas', () => {
            const schema = { type: 'object' };
            const ajv = (validator as any).ajv;
            const compiledSchema = ajv.compile(schema);

            (validator as any).validators.set('test.event.1', compiledSchema);
            (validator as any).validators.set('test.event.2', compiledSchema);

            expect(validator.getSchemaCount()).toBe(2);
        });
    });
});

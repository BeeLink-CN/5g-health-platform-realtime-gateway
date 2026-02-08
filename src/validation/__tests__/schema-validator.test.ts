import { SchemaValidator } from '../schema-validator';

describe('SchemaValidator', () => {
    let validator: SchemaValidator;

    beforeEach(() => {
        validator = new SchemaValidator();
    });

    describe('loadSchemas', () => {
        it('should load and compile event schemas successfully', async () => {
            // This test requires contracts to be present
            // Skip in CI if contracts not available
            if (!process.env.CONTRACTS_PATH) {
                console.log('Skipping test - CONTRACTS_PATH not set');
                return;
            }

            await validator.loadSchemas();
            expect(validator.getSchemaCount()).toBe(4);
        });
    });

    describe('validate', () => {
        it('should return false for unknown event types', () => {
            const result = validator.validate('unknown.event' as any, {});
            expect(result).toBe(false);
        });

        it('should validate vitals.recorded events when schemas loaded', async () => {
            if (!process.env.CONTRACTS_PATH) {
                console.log('Skipping test - CONTRACTS_PATH not set');
                return;
            }

            await validator.loadSchemas();

            const validEvent = {
                event_name: 'vitals.recorded',
                event_version: '1.0.0',
                event_id: '550e8400-e29b-41d4-a716-446655440000',
                timestamp: new Date().toISOString(),
                source: 'test',
                payload: {
                    patient_id: '550e8400-e29b-41d4-a716-446655440001',
                    vital_type: 'heart_rate',
                    value: 72,
                    unit: 'bpm',
                    measured_at: new Date().toISOString(),
                    source: 'test-device',
                },
            };

            const result = validator.validate('vitals.recorded', validEvent);
            expect(result).toBe(true);
        });
    });
});

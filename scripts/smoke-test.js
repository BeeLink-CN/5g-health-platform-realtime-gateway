// Quick smoke test - verify gateway receives and delivers events
const WebSocket = require('ws');
const { connect, StringCodec } = require('nats');

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const GATEWAY_WS = process.env.GATEWAY_WS || 'ws://localhost:8080/ws';
const TIMEOUT = 10000; // 10 seconds

const sc = StringCodec();

async function smokeTest() {
    console.log('🧪 Starting smoke test...\n');

    let natsConn;
    let ws;
    let testPassed = false;

    try {
        // 1. Connect to NATS
        console.log('📡 Connecting to NATS...');
        natsConn = await connect({ servers: NATS_URL });
        console.log('✅ NATS connected\n');

        // 2. Connect to Gateway WebSocket
        console.log('🔌 Connecting to Gateway WebSocket...');
        ws = new WebSocket(GATEWAY_WS);

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });
        console.log('✅ WebSocket connected\n');

        // 3. Subscribe to dispatch.created events
        console.log('📨 Subscribing to dispatch.created...');
        const subscribeMsg = {
            type: 'subscribe',
            patient_id: null,
            events: ['dispatch.created']
        };
        ws.send(JSON.stringify(subscribeMsg));

        // Wait for subscription confirmation
        await new Promise((resolve) => {
            ws.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'subscribed') {
                    console.log('✅ Subscription confirmed\n');
                    resolve();
                }
            });
            setTimeout(resolve, 1000); // Continue anyway after 1s
        });

        // 4. Set up event listener
        console.log('👂 Listening for events...');
        const eventPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Event delivery timeout'));
            }, TIMEOUT);

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    if (msg.type === 'event' && msg.event_name === 'dispatch.created') {
                        clearTimeout(timeout);
                        console.log('✅ Event received via WebSocket!');
                        console.log('   Event ID:', msg.data.event_id);
                        console.log('   Received at:', msg.received_at);
                        resolve(msg);
                    }
                } catch (err) {
                    // Ignore parse errors
                }
            });
        });

        // 5. Publish test event to NATS
        console.log('📤 Publishing test event to NATS...');
        const testEvent = {
            event_name: 'dispatch.created',
            event_version: '1.0.0',
            event_id: '11111111-1111-1111-1111-111111111111',
            timestamp: new Date().toISOString(),
            payload: {
                dispatch_id: '22222222-2222-2222-2222-222222222222',
                patient_id: '33333333-3333-3333-3333-333333333333',
                priority: 'high',
                dispatch_type: 'ambulance'
            }
        };

        natsConn.publish('dispatch.created', sc.encode(JSON.stringify(testEvent)));
        console.log('✅ Event published to NATS\n');

        // 6. Wait for event delivery
        await eventPromise;

        testPassed = true;
        console.log('\n✅ SMOKE TEST PASSED! 🎉');
        console.log('   End-to-end event delivery verified.\n');

    } catch (err) {
        console.error('\n❌ SMOKE TEST FAILED!');
        console.error('   Error:', err.message);
        console.error('');
    } finally {
        // Cleanup
        if (ws) {
            ws.close();
        }
        if (natsConn) {
            await natsConn.drain();
        }

        process.exit(testPassed ? 0 : 1);
    }
}

// Run test
smokeTest().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});

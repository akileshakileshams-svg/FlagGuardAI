import { Flagsmith } from '@flagsmith/nodejs';
import { randomUUID } from 'node:crypto';

const flagsmith = new Flagsmith({
    environmentKey: process.env.FLAGSMITH_ENVIRONMENT_KEY,
    enableEvents: true,
    apiUrl: 'http://127.0.0.1:8000/api/v1/',
    eventProcessorConfig: {
        eventsApiUrl: 'http://127.0.0.1:8000/api/'
    }
});

try {
    const user = `simulated-test-${randomUUID()}`;

    const flag = await flagsmith.getExperimentFlag(
        'checkout_experiment',
        user
    );

    console.log('EXPERIMENT FLAG:');
    console.log(JSON.stringify(flag, null, 2));

    if (!flag?.experiment?.inExperiment) {
        throw new Error('User not enrolled in experiment');
    }

    flagsmith.trackEvent('checkout_completed', {
        identifier: user,
        metadata: {
            source: 'simulated_sdk_test'
        }
    });

    console.log('Conversion event queued');

} finally {
    await flagsmith.close();
}

console.log('SDK TEST COMPLETED');

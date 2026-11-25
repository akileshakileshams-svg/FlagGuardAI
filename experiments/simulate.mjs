import { Flagsmith } from '@flagsmith/nodejs';
import { randomUUID } from 'node:crypto';

const key = process.env.FLAGSMITH_ENVIRONMENT_KEY;

if (!key) {
    throw new Error('Environment key missing');
}

const flagsmith = new Flagsmith({
    environmentKey: key,
    enableEvents: true,
    apiUrl: 'http://127.0.0.1:8000/api/v1/',
    eventProcessorConfig: {
        eventsApiUrl: 'http://127.0.0.1:8000/api/'
    }
});

const count = Number(process.argv[2] || 20);

const stats = {
    control: { users: 0, conversions: 0 },
    express: { users: 0, conversions: 0 }
};

try {
    for (let i = 0; i < count; i++) {

        const user = `simulated-${randomUUID()}`;

        const flag = await flagsmith.getExperimentFlag(
            'checkout_experiment',
            user
        );

        if (!flag?.experiment?.inExperiment) {
            throw new Error('User not enrolled');
        }

        const value = flag.value;

        if (value !== 'control' && value !== 'express') {
            console.log(JSON.stringify(flag, null, 2));
            throw new Error('Unexpected variation value');
        }

        stats[value].users++;

        // Synthetic conversion probabilities for demo only.
        const probability = value === 'express' ? 0.65 : 0.40;

        if (Math.random() < probability) {
            flagsmith.trackEvent('checkout_completed', {
                identifier: user,
                metadata: {
                    source: 'simulated',
                    scenario: 'checkout_conversion'
                }
            });

            stats[value].conversions++;
        }

        if ((i + 1) % 10 === 0) {
            console.log(`Processed ${i + 1}/${count} users`);
        }
    }
} finally {
    await flagsmith.close();
}

console.log('SIMULATED TRAFFIC SUMMARY');
console.table(stats);
console.log('SIMULATION COMPLETED');

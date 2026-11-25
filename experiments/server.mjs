import http from 'node:http';
import { Flagsmith } from '@flagsmith/nodejs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const key = process.env.FLAGSMITH_ENVIRONMENT_KEY;

if (!key) {
    throw new Error('Environment key missing');
}

const base = (
    process.env.FLAGSMITH_API_URL ||
    'http://127.0.0.1:8000/api/v1/'
).replace(/\/+$/, '') + '/';

function createClient() {
    return new Flagsmith({
        environmentKey: key,
        enableEvents: true,
        apiUrl: base,
        eventProcessorConfig: {
            eventsApiUrl: base.replace(/v1\/$/, '')
        }
    });
}

const db = new DatabaseSync('/data/experiment-sdk.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
        identity TEXT PRIMARY KEY,
        variant TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'assigned',
        created_at TEXT NOT NULL,
        completed_at TEXT
    )
`);

const origins = new Set([
    'http://127.0.0.1:3001',
    'http://localhost:3001'
]);

function send(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(data));
}

async function readBody(req) {
    let body = '';

    for await (const chunk of req) {
        body += chunk;

        if (body.length > 4096) {
            throw new Error('Request too large');
        }
    }

    return JSON.parse(body || '{}');
}

const server = http.createServer(async (req, res) => {

    const origin = req.headers.origin;

    if (origin && !origins.has(origin)) {
        return send(res, 403, {
            error: 'Origin not allowed'
        });
    }

    if (origin) {
        res.setHeader(
            'Access-Control-Allow-Origin',
            origin
        );
        res.setHeader('Vary', 'Origin');
    }

    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
    );

    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
    );

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, 'http://localhost');

    try {

        if (req.method === 'GET' &&
            url.pathname === '/health') {

            return send(res, 200, {
                status: 'healthy',
                service: 'FlagGuard Experiment SDK'
            });
        }

        if (req.method === 'POST' &&
            url.pathname === '/api/experiment/assign') {

            const identity = `demo-${randomUUID()}`;
            const client = createClient();

            let flag;

            try {
                flag = await client.getExperimentFlag(
                    'checkout_experiment',
                    identity
                );
            } finally {
                await client.close();
            }

            if (!flag?.experiment?.inExperiment) {
                return send(res, 409, {
                    error: 'Experiment enrollment unavailable'
                });
            }

            if (!['control', 'express'].includes(flag.value)) {
                return send(res, 502, {
                    error: 'Unexpected experiment variant'
                });
            }

            db.prepare(`
                INSERT INTO assignments
                (identity, variant, created_at)
                VALUES (?, ?, ?)
            `).run(
                identity,
                flag.value,
                new Date().toISOString()
            );

            return send(res, 200, {
                identity,
                variant: flag.value,
                enrolled: true,
                feature: 'checkout_experiment',
                source: 'flagsmith_native',
                data_source: 'manual_demo_test'
            });
        }

        if (req.method === 'POST' &&
            url.pathname === '/api/experiment/convert') {

            let body;

            try {
                body = await readBody(req);
            } catch {
                return send(res, 400, {
                    error: 'Invalid request body'
                });
            }

            if (typeof body.identity !== 'string') {
                return send(res, 400, {
                    error: 'Identity required'
                });
            }

            const record = db.prepare(`
                SELECT * FROM assignments
                WHERE identity = ?
            `).get(body.identity);

            if (!record) {
                return send(res, 404, {
                    error: 'Unknown demo identity'
                });
            }

            const claim = db.prepare(`
                UPDATE assignments
                SET status = 'processing'
                WHERE identity = ?
                AND status = 'assigned'
            `).run(body.identity);

            if (Number(claim.changes) !== 1) {
                return send(res, 200, {
                    duplicate: true,
                    identity: body.identity,
                    status: record.status
                });
            }

            try {
                const client = createClient();

                try {
                    client.trackEvent('checkout_completed', {
                        identifier: body.identity,
                        metadata: {
                            source: 'manual_demo_test',
                            scenario: 'checkout_conversion'
                        }
                    });
                } finally {
                    await client.close();
                }

                db.prepare(`
                    UPDATE assignments
                    SET status = 'submitted',
                        completed_at = ?
                    WHERE identity = ?
                `).run(
                    new Date().toISOString(),
                    body.identity
                );

                return send(res, 200, {
                    identity: body.identity,
                    variant: record.variant,
                    event: 'checkout_completed',
                    status: 'submitted',
                    duplicate: false,
                    source: 'flagsmith_native',
                    data_source: 'manual_demo_test'
                });

            } catch {

                db.prepare(`
                    UPDATE assignments
                    SET status = 'uncertain'
                    WHERE identity = ?
                `).run(body.identity);

                return send(res, 502, {
                    error: 'Event delivery uncertain'
                });
            }
        }

        if (req.method === 'GET' &&
            url.pathname === '/api/experiment/stats') {

            const rows = db.prepare(`
                SELECT variant,
                       status,
                       COUNT(*) AS count
                FROM assignments
                GROUP BY variant, status
            `).all();

            return send(res, 200, {
                source: 'manual_demo_test',
                assignments: rows
            });
        }

        return send(res, 404, {
            error: 'Endpoint not found'
        });

    } catch {

        return send(res, 502, {
            error: 'Experiment service request failed'
        });
    }
});

server.listen(8081, '0.0.0.0', () => {
    console.log('Experiment SDK service ready');
});

function shutdown() {
    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

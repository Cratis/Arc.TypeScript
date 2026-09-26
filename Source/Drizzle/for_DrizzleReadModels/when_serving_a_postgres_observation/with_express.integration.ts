// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { field } from '@cratis/fundamentals';
import { ArcApplication, key, query, readModel, service } from '@cratis/arc.core';
import { cratisArc } from '../../../Express/index.js';
import { DrizzleDialect, DrizzleObservation, drizzleReadModel, nodePostgresListener,
    postgresqlChangeTrigger, type DrizzleReadModels } from '../../index.js';

class StreamTask { @field(String) @key() id!: string; @field(String) title!: string; }
const tasks = pgTable('tasks', { id: text('id').primaryKey(), title: text('title').notNull() });
@readModel()
class StreamTasks {
    @query({ observable: true }, service(drizzleReadModel(StreamTask)))
    static all(models: DrizzleReadModels<StreamTask>) { return models.observe(); }
}

describe('when serving an experimental PostgreSQL observation through SSE', () => {
    it('should send the initial snapshot and a raw SQL update, then release the listener on disconnect', async () => {
        const uri = process.env.ARC_POSTGRES_TEST_URI;
        if (!uri) throw new Error('ARC_POSTGRES_TEST_URI is required');
        const schema = `arc_notify_sse_${process.pid}`;
        const applicationName = `arc_notify_sse_${process.pid}`;
        const admin = new Pool({ connectionString: uri });
        let pool: Pool | undefined;
        let server: Server | undefined;
        let application: ArcApplication | undefined;
        const controller = new AbortController();
        try {
            await admin.query(`CREATE SCHEMA "${schema}"`);
            await admin.query(`CREATE TABLE "${schema}".tasks (id text PRIMARY KEY, title text NOT NULL)`);
            await admin.query(postgresqlChangeTrigger(tasks, { schema }));
            await admin.query(`INSERT INTO "${schema}".tasks VALUES ('1', 'initial')`);
            pool = new Pool({ connectionString: uri, options: `-c search_path=${schema}` });
            const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });
            builder.add(StreamTasks).withDrizzle({ dialect: DrizzleDialect.PostgreSQL, database: drizzle(pool),
                readModels: [{ type: StreamTask, table: tasks }],
                observation: { mode: DrizzleObservation.PostgreSQLNotify,
                    listener: () => nodePostgresListener(new Client({ connectionString: uri, application_name: applicationName })) } });
            application = await builder.build();
            const host = express(); host.use(cratisArc(application));
            server = createServer(host);
            await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
            const address = server.address();
            if (!address || typeof address === 'string') throw new Error('No SSE port');
            const route = [...application.server.endpoints.keys()].find(path => path.endsWith('/all'));
            if (!route) throw new Error('SSE route missing');
            const url = `http://127.0.0.1:${address.port}${route}`;
            const snapshot = await fetch(url);
            snapshot.status.should.equal(200);
            const response = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
            response.status.should.equal(200);
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const next = async (): Promise<{ data: { title: string }[] }> => {
                while (true) {
                    const boundary = buffer.indexOf('\n\n');
                    if (boundary >= 0) {
                        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
                        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5)).join('');
                        if (data) return JSON.parse(data) as { data: { title: string }[] };
                        continue;
                    }
                    const part = await reader.read();
                    if (part.done) throw new Error('SSE closed before result');
                    buffer += decoder.decode(part.value, { stream: true }).replaceAll('\r\n', '\n');
                }
            };
            (await next()).data[0]!.title.should.equal('initial');
            await admin.query(`UPDATE "${schema}".tasks SET title = 'external' WHERE id = '1'`);
            (await next()).data[0]!.title.should.equal('external');
            controller.abort(); await reader.cancel().catch(() => {});
            const deadline = Date.now() + 4000;
            while (Date.now() < deadline) {
                const result = await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1', [applicationName]);
                if (result.rows[0].count === 0) break;
                await new Promise<void>(resolve => setTimeout(resolve, 15));
            }
            const remaining = await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1', [applicationName]);
            remaining.rows[0].count.should.equal(0);
        } finally {
            controller.abort();
            if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
            await application?.dispose(); await pool?.end();
            await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
            await admin.end();
        }
    });
});

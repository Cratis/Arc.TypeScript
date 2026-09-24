// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer, currentServices, defineCommand, defineQuery, serviceToken, validation } from '@cratis/arc.server';
import { TaskRepository } from './TaskRepository.js';
import { mountHono } from '@cratis/arc.server.hono';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = serviceToken<TaskRepository>('tasks repository');
const create = defineCommand({
    name: 'Create', namespace: 'Tasks', schema: z.object({ id: z.string(), title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    handlerDependencies: [repository],
    handle: async ({ id, title }) => { (await currentServices().resolve(repository)).save(id, title); return { id }; }
});
const list = defineQuery({
    name: 'List', namespace: 'Tasks', schema: z.object({ search: z.string().default('') }),
    handlerDependencies: [repository],
    perform: async ({ search }) => (await currentServices().resolve(repository)).list(search)
});
export const server = new ArcServer({ commands: [create], queries: [list], services: [
    { token: repository, lifetime: 'singleton', factory: () => new TaskRepository() }
] });
export const app = new Hono();
mountHono(app, server);
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
}

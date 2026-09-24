// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Env, Hono } from 'hono';
import type { ArcServer } from '@cratis/arc.server';

export function mountHono<E extends Env>(app: Hono<E>, server: ArcServer): void {
    app.use('*', async (context, next) => {
        const result = await server.handle(context.req.raw);
        if (!result) return next();
        return result;
    });
}

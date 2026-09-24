// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

export class a_server_with_a_list_query {
    server = new ArcServer({ queries: [defineQuery({
        name: 'List', namespace: 'Tasks',
        schema: z.object({ limit: z.number(), label: z.string().default('all') }),
        perform: ({ limit, label }) => Array.from({ length: limit }, (_, index) => ({ index, label }))
    })] });
}

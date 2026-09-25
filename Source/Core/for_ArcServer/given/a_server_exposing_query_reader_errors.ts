// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

export class a_server_exposing_query_reader_errors {
    server = new ArcServer({ exposeExceptionDetails: true,
        queries: [defineQuery({ name: 'Items', schema: z.object({}), perform: () => [] })] });
}

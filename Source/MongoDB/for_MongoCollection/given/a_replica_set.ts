// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { MongoClient } from 'mongodb';
import type { ExecutionContext } from '@cratis/arc.core';
export class a_replica_set {
    readonly name = `arc_mongo_${crypto.randomUUID().replaceAll('-', '')}`;
    readonly client = new MongoClient(process.env.ARC_MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27017',
        { serverSelectionTimeoutMS: 5000 });
    context(tenantId: string): ExecutionContext {
        return { tenantId, principal: undefined, correlationId: crypto.randomUUID(),
            signal: new AbortController().signal, allowedSeverity: 3 };
    }
}

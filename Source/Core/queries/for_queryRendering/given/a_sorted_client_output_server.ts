// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import type { ClientContract } from '../../../introspection/ClientContract.js';
import { defineQuery } from '../../defineQuery.js';
import { defineObservableQuery } from '../../observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../observable/CurrentValueSubject.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { markRawReadModelDocument } from '../../rawReadModelDocuments.js';

class Secret {
    constructor(readonly order: number, readonly name: string) {}
}

export class a_sorted_client_output_server {
    readonly seen: number[] = [];
    readonly server: ArcServer;
    constructor(raw: boolean, release: boolean) {
        const released = new WeakSet<object>();
        const token = serviceToken<ReadModelInterceptor>('protect sorted rows');
        const clientOutput: ClientContract = { output: { kind: 'array', element: { kind: 'dto', name: 'Secret', fields: [
            { name: 'order', type: { kind: 'number' } }, { name: 'name', type: { kind: 'string' } }
        ] } } };
        const rows = (tenantId: string): object[] => [2, 1].map(order => raw
            ? markRawReadModelDocument({ order, name: 'private' }, { model: Secret, tenantId, subject: String(order) })
            : new Secret(order, 'private'));
        this.server = new ArcServer({
            introspection: { enabled: false },
            tenancy: { resolve: () => 'tenant-a' },
            services: [{ token, lifetime: ServiceLifetime.Scoped, factory: (): ReadModelInterceptor => ({
                model: Secret,
                isReleased: (model: object) => released.has(model),
                intercept: (model: object) => {
                    const row = model as Secret;
                    this.seen.push(row.order);
                    if (!release) return row;
                    const result = new Secret(row.order, 'masked');
                    released.add(result);
                    return result;
                },
                interceptRawDocument: (model: object, provenance) => {
                    const row = model as Secret;
                    this.seen.push(row.order);
                    return release ? { order: row.order, name: 'masked' }
                        : markRawReadModelDocument({ ...row }, provenance);
                }
            }) }],
            readModelInterceptors: [token],
            queries: [defineQuery({ name: 'All', schema: z.object({}), clientOutput, perform: (_, context) => rows(context.tenantId!) })],
            observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}), clientOutput,
                observe: (_, context) => CurrentValueSubject.of(rows(context.tenantId!)) })]
        });
    }
}

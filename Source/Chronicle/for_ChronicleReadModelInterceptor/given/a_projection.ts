// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle/compliance';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { reducer } from '@cratis/chronicle/reducers';
import { ArcApplication, defineQuery, readModel } from '@cratis/arc.core';
import type { QueryResult } from '@cratis/arc.core';
import { z } from 'zod';
import '../../index.js';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import sinon from 'sinon';
import { ChronicleArtifacts } from '../../ChronicleArtifacts.js';
import { ChronicleReadModelInterceptor } from '../../ChronicleReadModelInterceptor.js';
import type { ChronicleRuntime } from '../../ChronicleRuntime.js';

@eventType() class Created { @field(String) name = ''; }
@readModel() @fromEvent(Created)
class PrivateView { @field(String) id = ''; @field(String) @pii() name = ''; }
@readModel() @fromEvent(Created)
class PublicView { @field(String) id = ''; @field(String) name = ''; }
class ReducedView { @field(String) id = ''; @field(String) @pii() name = ''; }
@reducer('reduced-view', undefined, ReducedView) class ReducedViewReducer {}

export class a_projection {
    readonly artifacts = new ChronicleArtifacts();
    readonly privateView = new PrivateView();
    readonly publicView = new PublicView();
    readonly reducedView = new ReducedView();
    readonly release = sinon.stub().callsFake(async (_type: typeof PrivateView, model: PrivateView) => {
        const result = new PrivateView();
        Object.assign(result, model, { name: 'plain' });
        return result;
    });
    readonly getStore = sinon.stub().callsFake(async (): Promise<IEventStore> =>
        ({ readModels: { release: this.release } }) as unknown as IEventStore);
    readonly context = { tenantId: 'tenant-a' } as ExecutionContext;
    readonly runtime = { getStore: this.getStore } as unknown as ChronicleRuntime;
    constructor() {
        for (const type of [Created, PrivateView, PublicView, ReducedViewReducer]) this.artifacts.register(type);
    }
    async query(data: unknown): Promise<QueryResult> {
        const builder = ArcApplication.createBuilder({
            queries: [defineQuery({ name: 'Private', schema: z.object({}), perform: () => data })]
        });
        builder.withChronicle({ eventStore: 'Test', client: { getEventStore: this.getStore } as unknown as IChronicleClient });
        builder.add(PrivateView, Created);
        const application = await builder.build();
        try { return await application.server.performQuery('Private', {}, this.context); }
        finally { await application.dispose(); }
    }
    interceptor(type: 'private' | 'public' | 'reducer'): ChronicleReadModelInterceptor {
        const model = { private: PrivateView, public: PublicView, reducer: ReducedView }[type];
        return new ChronicleReadModelInterceptor(model, this.runtime, this.context, this.artifacts);
    }
}

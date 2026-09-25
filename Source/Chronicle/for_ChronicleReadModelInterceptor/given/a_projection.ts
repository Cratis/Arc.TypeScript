// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle/compliance';
import { encrypted } from '@cratis/chronicle/confidentiality';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { reducer } from '@cratis/chronicle/reducers';
import { ArcApplication, CurrentValueSubject, defineObservableQuery, defineQuery, readModel, Severity } from '@cratis/arc.core';
import type { QueryResult } from '@cratis/arc.core';
import { z } from 'zod';
import '../../index.js';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import sinon from 'sinon';
import { ChronicleArtifacts } from '../../ChronicleArtifacts.js';
import { ChronicleReadModelInterceptor } from '../../ChronicleReadModelInterceptor.js';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../../ChronicleRuntime.js';

@eventType() class Created { @field(String) name = ''; }
@readModel() @fromEvent(Created)
class PrivateView { @field(String) id = ''; @field(String) @pii() name = ''; }
@readModel() @fromEvent(Created)
class PublicView { @field(String) id = ''; @field(String) name = ''; }
class ReducedView { @field(String) id = ''; @field(String) @pii() name = ''; }
class InnerView { @field(String) @pii() value = ''; }
@readModel() class NestedView { @field(String) id = ''; @field(InnerView) inner = new InnerView(); }
@readModel() class ArrayView { @field(String) id = ''; @field(Array, { genericArguments: [InnerView] }) entries: InnerView[] = []; }
@pii() class PrivateValue { @field(String) value = ''; }
@readModel() class ClassLevelView { @field(PrivateValue) inner = new PrivateValue(); }
@readModel() class EncryptedView { @field(String) @encrypted() secret = ''; }
@reducer('reduced-view', undefined, ReducedView) class ReducedViewReducer {}

export class a_projection {
    readonly artifacts = new ChronicleArtifacts();
    readonly model = PrivateView;
    readonly reducerModel = ReducedView;
    readonly nestedModel = NestedView;
    readonly arrayModel = ArrayView;
    readonly classLevelModel = ClassLevelView;
    readonly encryptedModel = EncryptedView;
    readonly privateView = new PrivateView();
    readonly publicView = new PublicView();
    readonly reducedView = new ReducedView();
    readonly release = sinon.stub().callsFake(async (_type: typeof PrivateView, model: PrivateView) => {
        const result = new PrivateView();
        Object.assign(result, model, { name: 'plain' });
        return result;
    });
    readonly find = sinon.stub().resolves(this.privateView);
    readonly getInstances = sinon.stub().resolves([this.privateView]);
    readonly watch = sinon.stub().callsFake(async function* (this: a_projection) {
        yield { key: '1', readModel: this.privateView, removed: false };
    }.bind(this));
    readonly getStore = sinon.stub().callsFake(async (): Promise<IEventStore> =>
        ({ readModels: { release: this.release, findInstanceById: this.find,
            getInstances: this.getInstances, watch: this.watch } }) as unknown as IEventStore);
    readonly context = { tenantId: 'tenant-a' } as ExecutionContext;
    readonly runtime = { getStore: this.getStore } as unknown as ChronicleRuntime;
    constructor() {
        for (const type of [Created, PrivateView, PublicView, ReducedViewReducer]) this.artifacts.register(type);
    }
    async registeredInterceptors(): Promise<number> {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Test', client: { getEventStore: this.getStore } as unknown as IChronicleClient });
        builder.add(ReducedViewReducer, PublicView, PrivateView, Created);
        const application = await builder.build();
        try { return application.server.options.readModelInterceptors?.length ?? 0; }
        finally { await application.dispose(); }
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
    models(): ChronicleReadModels { return new ChronicleReadModels(this.runtime, this.context); }
    async observable(data: object): Promise<QueryResult> {
        const builder = ArcApplication.createBuilder({
            observableQueries: [defineObservableQuery({ name: 'PrivateWatch', schema: z.object({}),
                observe: () => CurrentValueSubject.of(data) })]
        });
        builder.withChronicle({ eventStore: 'Test', client: { getEventStore: this.getStore } as unknown as IChronicleClient });
        builder.add(PrivateView, Created);
        const application = await builder.build();
        try {
            const session = await application.server.openObservableQuery('PrivateWatch', {}, {
                ...this.context, correlationId: crypto.randomUUID(), principal: undefined,
                signal: new AbortController().signal, allowedSeverity: Severity.Warning
            });
            try { return (await session.results().next()).value!; }
            finally { await session.close(); }
        } finally { await application.dispose(); }
    }
    interceptor(type: 'private' | 'public' | 'reducer'): ChronicleReadModelInterceptor {
        const model = { private: PrivateView, public: PublicView, reducer: ReducedView }[type];
        return new ChronicleReadModelInterceptor(model, this.runtime, this.context);
    }
}

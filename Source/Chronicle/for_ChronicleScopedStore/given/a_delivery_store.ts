// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import type { EventContext } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { ArtifactDelivery, ArtifactKind } from '@cratis/chronicle/artifacts';
import type { ArtifactActivationContext, ArtifactInvocationContext } from '@cratis/chronicle/artifacts';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { ArcApplication, command, commandReadModel, currentContext, inject, key, readModel, Severity } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import sinon from 'sinon';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { AggregateRoot, ChronicleReadModels, chronicleArtifactActivator, commandAggregate, reactorCommandResultHandler } from '../../index.js';
import type { ChronicleArtifactActivator } from '../../index.js';

@eventType() export class OrderPlaced { @field(String) name = ''; }
@eventType() export class OrderShipped {}
@readModel() @fromEvent(OrderPlaced)
export class Order { @field(String) id = ''; @field(String) name = ''; }
export class Shipment extends AggregateRoot {}

/** Signals the commands a reactor returned ran with. */
export const commandSignals: AbortSignal[] = [];

@command() export class ShipOrder {
    @field(String) @key() id = '';
    @inject(commandReadModel(Order), commandAggregate(Shipment))
    handle(order: Order, shipment: Shipment) {
        commandSignals.push(currentContext()!.signal);
        shipment.apply(new OrderShipped());
        return shipment.commit();
    }
}

export class OrderReactor {
    constructor(readonly readModels: ChronicleReadModels) {}
    async placed(): Promise<ShipOrder> {
        await this.readModels.getById(Order, 'from-handler');
        return Object.assign(new ShipOrder(), { id: 'order-1' });
    }
}

type BuiltApplication = Awaited<ReturnType<ReturnType<typeof ArcApplication.createBuilder>['build']>>;

export class a_delivery_store {
    readonly eventStore = 'Orders';
    readonly tenant = 'tenant-a';
    readonly find = sinon.stub().callsFake(async (_type: unknown, id: string) => Object.assign(new Order(), { id, name: 'Ada' }));
    readonly tail = sinon.stub().resolves(EventSequenceNumber.unset);
    readonly history = sinon.stub().resolves([]);
    readonly appendMany = sinon.stub().callsFake(async (events: unknown[]) => events.map(() => accepted()));
    readonly store = {
        name: { value: this.eventStore }, namespace: { value: this.tenant },
        readModels: { findInstanceById: this.find },
        eventTypes: { all: [OrderPlaced, OrderShipped] },
        eventLog: { getTailSequenceNumber: this.tail, getForEventSourceIdAndEventTypes: this.history, appendMany: this.appendMany }
    } as unknown as IEventStore;
    readonly runtimeStore = sinon.stub<[string, string], Promise<IEventStore>>();
    delivery = new AbortController();
    application!: BuiltApplication;
    activator!: ChronicleArtifactActivator;

    async build(): Promise<void> {
        commandSignals.length = 0;
        for (const stub of [this.find, this.tail, this.history, this.appendMany]) stub.resetHistory();
        this.runtimeStore.reset();
        this.runtimeStore.rejects(new Error('the runtime client must not be used'));
        this.delivery = new AbortController();
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: this.eventStore, client: { getEventStore: this.runtimeStore } as unknown as IChronicleClient });
        builder.add(Order, OrderPlaced, OrderShipped, ShipOrder);
        builder.services.addScoped(OrderReactor, async scope => new OrderReactor(await scope.resolve(ChronicleReadModels)));
        this.application = await builder.build();
        this.activator = chronicleArtifactActivator(() => this.application.server, this.eventStore);
    }

    readonly event = { eventSourceId: 'order-1', sequenceNumber: 7n, eventType: { id: { value: 'order-placed' } },
        correlationId: crypto.randomUUID() } as unknown as EventContext;

    /** Deliver one event to the reactor the way the SDK does, handing its result to Arc's result handler. */
    async deliver(beforeResult: () => void = () => {}, namespace = this.tenant): Promise<void> {
        const context = { kind: ArtifactKind.Reactor, artifactId: 'orders-reactor', eventSequenceId: 'event-log', partition: 'order-1',
            signal: this.delivery.signal, readModels: this.store.readModels, eventStore: this.store,
            delivery: ArtifactDelivery.Events, eventContext: this.event } as unknown as ArtifactActivationContext;
        const invocation = { delivery: ArtifactDelivery.Events, eventContext: this.event, methodName: 'placed' } as unknown as ArtifactInvocationContext;
        const handleResult = reactorCommandResultHandler(() => this.application.server, this.eventStore);
        const artifact = await this.activator(OrderReactor, context);
        try {
            await artifact.run!(async () => {
                const result = await artifact.instance.placed();
                beforeResult();
                await handleResult(result, this.event, OrderReactor, this.eventStore, namespace);
            }, invocation);
            await artifact.complete!();
        } finally { await artifact.dispose?.(); }
    }

    context(): ExecutionContext {
        return { tenantId: this.tenant, correlationId: crypto.randomUUID(), principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
    }

    async dispose(): Promise<void> { await this.application?.dispose(); }
}

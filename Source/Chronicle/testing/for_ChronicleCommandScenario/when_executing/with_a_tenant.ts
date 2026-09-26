// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing in a tenant with its own history', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        scenario.given.forEventSource('same-id', 'tenant-b').events(new context.added(2));
        scenario.given.forEventSource('same-id', 'tenant-a').events(new context.added(7));
        Object.assign(scenario.context, { tenantId: 'tenant-b' });
        result = await scenario.execute({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reduce only events in the trusted tenant', () => {
        result.isSuccess.should.equal(true);
        result.shouldHaveAppendedEvent(context.checked, 'same-id', event => event.amount === 2);
        result.appendedEvents[0]!.tenant.should.equal('tenant-b');
    });
}));

describe('when selecting an event source before the trusted tenant is set', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        const source = scenario.given.forEventSource('same-id');
        Object.assign(scenario.context, { tenantId: 'tenant-b' });
        source.events(new context.added(7));
        result = await scenario.execute({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should seed history for the current tenant at append time', () => {
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(context.checked, 'same-id', event => event.amount === 7);
    });
}));

describe('when selecting a model before the trusted tenant is set', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        const source = scenario.given.forEventSource('same-id');
        Object.assign(scenario.context, { tenantId: 'tenant-b' });
        source.readModel(Object.assign(new context.state(), { count: 7 }));
        result = await scenario.execute({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should pin the model in the current tenant at pin time', () => {
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(context.checked, 'same-id', event => event.amount === 7);
    });
}));

describe('when pinning a model in the trusted tenant', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        Object.assign(scenario.context, { tenantId: 'tenant-b' });
        scenario.givenReadModel(context.state, 'same-id', { count: 7 });
        result = await scenario.execute({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should use the current tenant by default', () => {
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(context.checked, 'same-id', event => event.amount === 7);
    });
}));

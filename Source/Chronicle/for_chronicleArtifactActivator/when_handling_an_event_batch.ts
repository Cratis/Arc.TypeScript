// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentContext, currentServices } from '@cratis/arc.core';
import { ArtifactDelivery } from '@cratis/chronicle/artifacts';
import type { ArtifactInvocationContext } from '@cratis/chronicle/artifacts';
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor, Dependency, disposals } from './given/artifacts.js';

const invocation = (correlationId: string) =>
    ({ delivery: ArtifactDelivery.Events, eventContext: { correlationId }, methodName: 'observed' }) as unknown as ArtifactInvocationContext;

describe('when handling an event batch', given(an_activator, context => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID().toUpperCase();
    let handled: { tenant: string | undefined; correlation: string }[];
    let effect: { tenant: string | undefined; correlation: string };
    let resolved: Dependency[];
    let instance: ActivatedReactor;
    let disposedBeforeComplete: number;
    beforeEach(async () => {
        await context.build();
        handled = []; resolved = [];
        await context.deliver(ActivatedReactor, context.events(first), async artifact => {
            instance = artifact.instance;
            for (const correlation of [first, second]) {
                await artifact.run!(async () => {
                    handled.push(artifact.instance.observed());
                    resolved.push(await currentServices().resolve(Dependency));
                    await Promise.resolve();
                    const returned = currentContext()!;
                    effect = { tenant: returned.tenantId, correlation: returned.correlationId };
                }, invocation(correlation));
            }
            disposedBeforeComplete = disposals.length;
        });
    });
    afterEach(() => context.dispose());
    it('should use the observation namespace as tenant', () => { handled.map(value => value.tenant).should.deep.equal([context.tenant, context.tenant]); });
    it('should use each event correlation', () => { handled.map(value => value.correlation).should.deep.equal([first, second.toLowerCase()]); });
    it('should keep the context for returned effects', () => { effect.should.deep.equal({ tenant: context.tenant, correlation: second.toLowerCase() }); });
    it('should resolve constructor dependencies from the batch scope', () => { resolved.should.deep.equal([instance.dependency, instance.dependency]); });
    it('should keep the scope open while handling', () => { disposedBeforeComplete.should.equal(0); });
    it('should dispose the batch scope once', () => { disposals.should.deep.equal([`dependency ${instance.dependency.id}`]); });
}));

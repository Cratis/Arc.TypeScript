// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
import type { ReadModelNamingPolicy } from '@cratis/chronicle';
import sinon from 'sinon';
import { given } from '../../given.js';
import { ChronicleRuntime } from '../../ChronicleRuntime.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';

describe('when creating the Arc-owned client with an explicit naming policy and a collection name rule', given(a_chronicle_builder, context => {
    let fromConnectionString: sinon.SinonSpy;
    const explicit: ReadModelNamingPolicy = identifier => `explicit-${identifier}`;
    beforeEach(async () => {
        fromConnectionString = sinon.spy(ChronicleOptions, 'fromConnectionString');
        context.start();
        context.withArcOwnedConnection(false, explicit);
        context.withCollectionNameRule(type => type.name);
        await context.build();
        await context.inScope(scope => scope.resolve(ChronicleRuntime));
    });
    afterEach(async () => { fromConnectionString.restore(); await context.dispose(); });
    it('should pass the explicit policy to the client', () => { fromConnectionString.lastCall.args[1].readModelNamingPolicy.should.equal(explicit); });
}));

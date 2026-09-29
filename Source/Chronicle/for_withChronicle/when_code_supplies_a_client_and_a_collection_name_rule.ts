// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
import sinon from 'sinon';
import { given } from '../given.js';
import { ChronicleRuntime } from '../ChronicleRuntime.js';
import { a_chronicle_builder } from './when_registering_artifact_fallbacks/given/a_chronicle_builder.js';

describe('when code supplies a Chronicle client and a collection name rule is registered', given(a_chronicle_builder, context => {
    let fromConnectionString: sinon.SinonSpy;
    beforeEach(async () => {
        fromConnectionString = sinon.spy(ChronicleOptions, 'fromConnectionString');
        context.start();
        context.withChronicle();
        context.withCollectionNameRule(type => type.name);
        await context.build();
        await context.inScope(scope => scope.resolve(ChronicleRuntime));
    });
    afterEach(async () => { fromConnectionString.restore(); await context.dispose(); });
    it('should not create or configure a client', () => { fromConnectionString.called.should.equal(false); });
}));

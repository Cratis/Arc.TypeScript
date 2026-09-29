// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
import type { ReadModelNamingPolicy } from '@cratis/chronicle';
import sinon from 'sinon';
import { given } from '../../given.js';
import { ChronicleRuntime } from '../../ChronicleRuntime.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';
import { Author } from '../given/a_read_model_class.js';

describe('when creating the Arc-owned client with a collection name rule registered after Chronicle', given(a_chronicle_builder, context => {
    let fromConnectionString: sinon.SinonSpy;
    let policy: ReadModelNamingPolicy;
    beforeEach(async () => {
        fromConnectionString = sinon.spy(ChronicleOptions, 'fromConnectionString');
        context.start();
        context.withArcOwnedConnection(false);
        context.withCollectionNameRule(type => `${type.name}s`);
        await context.build();
        await context.inScope(scope => scope.resolve(ChronicleRuntime));
        policy = fromConnectionString.lastCall.args[1].readModelNamingPolicy;
    });
    afterEach(async () => { fromConnectionString.restore(); await context.dispose(); });
    it('should name a read model class after the rule', () => { policy('Author', Author).should.equal('Authors'); });
    it('should keep the identifier when the client knows no class', () => { policy('custom-container').should.equal('custom-container'); });
}));

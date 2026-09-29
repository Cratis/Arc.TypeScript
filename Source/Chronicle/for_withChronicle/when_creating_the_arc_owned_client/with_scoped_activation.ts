// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
import sinon from 'sinon';
import { given } from '../../given.js';
import { ChronicleRuntime } from '../../ChronicleRuntime.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';

describe('when creating the Arc-owned client with scoped activation', given(a_chronicle_builder, context => {
    let fromConnectionString: sinon.SinonSpy;
    beforeEach(async () => {
        fromConnectionString = sinon.spy(ChronicleOptions, 'fromConnectionString');
        context.start();
        context.withArcOwnedConnection(true);
        await context.build();
        await context.inScope(scope => scope.resolve(ChronicleRuntime));
    });
    afterEach(async () => { fromConnectionString.restore(); await context.dispose(); });
    it('should pass the artifact activator to the client', () => {
        (typeof fromConnectionString.lastCall.args[1].artifactActivator).should.equal('function');
    });
}));

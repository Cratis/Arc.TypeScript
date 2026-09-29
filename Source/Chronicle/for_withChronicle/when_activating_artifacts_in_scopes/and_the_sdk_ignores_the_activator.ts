// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
import sinon from 'sinon';
import { given } from '../../given.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';

describe('when activating artifacts in scopes and the SDK ignores the activator', given(a_chronicle_builder, context => {
    let fromConnectionString: sinon.SinonStub;
    let failure: Error | undefined;
    beforeEach(() => {
        // Chronicle below 6.16 drops the unknown artifactActivator option.
        fromConnectionString = sinon.stub(ChronicleOptions, 'fromConnectionString').returns({} as ChronicleOptions);
        failure = undefined;
        context.start();
        try { context.withScopedActivation(); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => fromConnectionString.restore());
    it('should reject the registration', () => {
        failure!.message.should.equal('activateArtifactsInScopes requires @cratis/chronicle 6.17.0 or later');
    });
}));

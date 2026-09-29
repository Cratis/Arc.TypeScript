// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_sdk } from './given/an_sdk.js';
import { requireScopedActivationSupport } from '../requireScopedActivationSupport.js';

describe('when the SDK supports scoped activation', given(an_sdk, context => {
    let installedFailure: Error | undefined;
    beforeEach(() => {
        context.check(context.sdk(true, true));
        installedFailure = undefined;
        try { requireScopedActivationSupport('chronicle://localhost:35000', context.activator); }
        catch (error) { installedFailure = error as Error; }
    });
    it('should accept the simulated SDK', () => { (context.failure === undefined).should.equal(true); });
    it('should accept the installed SDK', () => { (installedFailure === undefined).should.equal(true); });
}));

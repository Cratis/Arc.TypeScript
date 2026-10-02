// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

describe('when configuring discovery with only named authentication handlers', () => {
    let responses: (Response | null)[];
    let context: a_discovery_host;
    beforeEach(async () => {
        context = new a_discovery_host();
        responses = await context.request({ authentication: [], authenticationSchemes: { Bearer: context.authentication } });
    });
    it('should not treat unselected schemes as default authentication', () => responses.should.deep.equal(Array(6).fill(null)));
    it('should warn that discovery is unavailable', () => context.warnings.calledOnce.should.be.true);
});

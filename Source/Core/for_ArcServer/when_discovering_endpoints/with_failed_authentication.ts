// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';

describe('when discovering endpoints with failed authentication', () => {
    let responses: (Response | null)[];
    let context: a_discovery_host;
    beforeEach(async () => {
        context = new a_discovery_host();
        responses = await context.request({ authentication: [() => ({ status: AuthenticationStatus.Failed }), context.authentication] }, { Authorization: 'Admin' });
    });
    it('should deny every description endpoint', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(401)));
    it('should not try another handler after explicit failure', () => context.authentication.called.should.be.false);
});

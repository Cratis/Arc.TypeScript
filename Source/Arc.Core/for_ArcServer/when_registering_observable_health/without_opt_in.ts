// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';

should();

describe('when registering observable health without opt-in', () => {
    let registered: boolean;
    let response: Response | null;

    beforeEach(async () => {
        const server = new ArcServer({});
        registered = server.endpoints.has('/.cratis/queries/health');
        response = await server.handle(new Request('http://localhost/.cratis/queries/health'));
        await server.dispose();
    });

    it('should leave the endpoint unregistered', () => { registered.should.equal(false); });
    it('should not handle health requests', () => { should().equal(response, null); });
});

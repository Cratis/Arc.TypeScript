// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { healthServer } from '../given/a_health_server.js';

should();

describe('when handling observable health with an anonymous caller', () => {
    let status: number | undefined;

    beforeEach(async () => {
        const server = healthServer();
        status = (await server.handle(new Request('http://localhost/.cratis/queries/health')))?.status;
        await server.dispose();
    });

    it('should deny without revealing connection metadata', () => { status?.should.equal(401); });
});

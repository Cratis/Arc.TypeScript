// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

should();

for (const host of hosts) describe(`when ${host} has no identity provider`, () => {
    let me: number;
    let schema: string;
    let users: string;

    beforeEach(async () => {
        const listener = await startHost(host, new ArcServer({}));
        try {
            me = (await socket(listener.port, false, '/.cratis/me')).status;
            schema = (await socket(listener.port, false, '/.cratis/identity-details/schema')).body;
            users = (await socket(listener.port, false, '/.cratis/users')).body;
        } finally { await listener.close(); }
    });

    it('should leave me unregistered', () => { me.should.equal(404); });
    it('should return an empty schema', () => { schema.should.equal('{}'); });
    it('should return no users', () => { users.should.equal('[]'); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { identityGet } from '../given/an_identity_request.js';

should();
describe('when registering identity endpoints without a provider', () => {
    let registered: boolean;
    let me: Response | null;
    let schema: unknown;
    let users: unknown;
    let tenants: unknown;
    let forgedStatus: number;
    beforeEach(async () => {
        const server = new ArcServer({});
        registered = server.endpoints.has('/.cratis/me');
        me = await identityGet(server, '/.cratis/me');
        schema = await (await identityGet(server, '/.cratis/identity-details/schema'))!.json();
        users = await (await identityGet(server, '/.cratis/users'))!.json();
        tenants = await (await identityGet(server, '/.cratis/tenants'))!.json();
        forgedStatus = (await identityGet(server, '/.cratis/users', { Cookie: '.cratis-identity=forged' }))!.status;
        await server.dispose();
    });
    it('should not register the me endpoint', () => registered.should.equal(false));
    it('should not handle me requests', () => (me === null).should.equal(true));
    it('should expose an empty identity schema', () => schema!.should.deep.equal({}));
    it('should expose empty user and tenant discovery', () => {
        users!.should.deep.equal([]);
        tenants!.should.deep.equal([]);
    });
    it('should not treat a display cookie as discovery authority', () => forgedStatus.should.equal(200));
});

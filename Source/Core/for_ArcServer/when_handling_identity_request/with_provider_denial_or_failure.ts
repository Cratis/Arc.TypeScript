// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityDetails, identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with provider denial or failure', () => {
    let denied: number;
    let failed: number;
    let broken: { status: number; text: string };
    beforeEach(async () => {
        const denial = new ArcServer({ identityDetails: { schema: z.object({}), provide: () => undefined }, authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })] });
        denied = (await identityGet(denial, '/.cratis/me'))!.status;
        const rejected = new ArcServer({ identityDetails, authentication: [() => ({ status: AuthenticationStatus.Failed }), () => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })] });
        failed = (await identityGet(rejected, '/.cratis/me'))!.status;
        const provider = new ArcServer({ identityDetails: { schema: z.object({}), provide: () => { throw Error('private account data'); } }, authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })] });
        const response = (await identityGet(provider, '/.cratis/me'))!;
        broken = { status: response.status, text: await response.text() };
        await Promise.all([denial.dispose(), rejected.dispose(), provider.dispose()]);
    });
    it('should deny an identity without details', () => denied.should.equal(403));
    it('should preserve a terminal authentication failure', () => failed.should.equal(401));
    it('should redact a failing provider', () => {
        broken.status.should.equal(500);
        broken.text.should.not.contain('private account data');
    });
});

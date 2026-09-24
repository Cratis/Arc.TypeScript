// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { jwtBearer } from '../jwtBearer.js';

describe('when configuring JWT verification without an audience', () => {
    let error: unknown;
    beforeEach(() => {
        try { jwtBearer({ jwksUrl: new URL('https://keys.example/jwks'), issuer: 'https://issuer.example/',
            audience: [], algorithms: ['RS256'] }); }
        catch (failure) { error = failure; }
    });
    it('should reject an empty audience list', () => { String(error).should.contain('Invalid JWT bearer configuration'); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery, InvalidAuthorizationConfiguration } from '../../index.js';

describe('when registering impossible or missing authentication schemes', () => {
    let errors: Error[];
    beforeEach(() => {
        const capture = (options: ConstructorParameters<typeof ArcServer>[0]) => {
            try { new ArcServer(options); } catch (error) { return error as Error; }
            throw new Error('Expected invalid configuration');
        };
        const query = (authorization: { requirements?: { schemes: string[] }[]; schemes?: string[] }) =>
            defineQuery({ name: 'Protected', schema: z.object({}), authorization, perform: () => true });
        errors = [
            capture({ authenticationSchemes: { A: () => ({ status: AuthenticationStatus.Anonymous }),
                B: () => ({ status: AuthenticationStatus.Anonymous }) },
            queries: [query({ requirements: [{ schemes: ['A'] }, { schemes: ['B'] }] })] }),
            capture({ authenticationSchemes: { A: undefined as never }, queries: [query({ schemes: ['A'] })] })
        ];
    });
    it('should reject independently stacked scheme requirements', () => { errors[0]!.should.be.instanceOf(InvalidAuthorizationConfiguration); });
    it('should reject a noncallable handler at build', () => { errors[1]!.should.be.instanceOf(InvalidAuthorizationConfiguration); });
});

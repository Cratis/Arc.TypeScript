// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineObservableQuery, InvalidAuthorizationConfiguration } from '../index.js';

describe('when configuring schemes on a hub-capable observable query', () => {
    let error: unknown;
    beforeEach(() => {
        try {
            new ArcServer({ authenticationSchemes: { Verified: () => ({ status: AuthenticationStatus.Anonymous }) },
                observableQueries: [defineObservableQuery({ name: 'Protected', schema: z.object({}),
                    authorization: { schemes: ['Verified'] }, observe: () => ({ subscribe: () => ({ unsubscribe() {} }) }) })] });
        } catch (failure) { error = failure; }
    });
    it('should reject the unsupported scheme before opening a hub connection', () => {
        (error as Error).should.be.instanceOf(InvalidAuthorizationConfiguration);
    });
});

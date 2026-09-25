// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

export function healthServer(maxConnectionsPerCaller?: number): ArcServer {
    return new ArcServer({ query: { enableObservableHealth: true,
        ...(maxConnectionsPerCaller === undefined ? {} : { maxObservableHubConnectionsPerCaller: maxConnectionsPerCaller }) },
        authentication: [request => {
            const id = request.headers.get('authorization');
            return id === 'alice' || id === 'bob'
                ? { status: AuthenticationStatus.Authenticated, principal: { id, roles: [], isAuthenticated: true } }
                : { status: AuthenticationStatus.Anonymous };
        }], observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject([1])
        })] });
}

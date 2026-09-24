// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, defineObservableQuery } from '../../index.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { given } from '../../given.js';
import { an_observable_policy } from '../given/an_observable_policy.js';

describe('when opening an observable query with a named policy', given(an_observable_policy, context => {
    let authorized: boolean | undefined;
    let validations: number;
    let observations: number;
    let evaluations: number;
    beforeEach(async () => {
        validations = 0;
        observations = 0;
        evaluations = 0;
        const server = new ArcServer({ authorizationPolicies: { Restricted: () => { evaluations++; return false; } },
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
                authorization: { policy: 'Restricted' }, validate: () => { validations++; return []; },
                observe: () => { observations++; return CurrentValueSubject.of(1); } })] });
        try {
            const session = await server.openObservableQuery('Numbers', {}, context.execution());
            authorized = session.rejection?.isAuthorized;
            await session.close();
        } finally { await server.dispose(); }
    });
    it('should deny before validation', () => { authorized?.should.equal(false); validations.should.equal(0); });
    it('should not start the source', () => { observations.should.equal(0); });
    it('should evaluate the policy once for the subscription', () => { evaluations.should.equal(1); });
}));

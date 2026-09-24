// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with an unauthorized caller', () => {
    let authorized: boolean | undefined;
    let validated: boolean;
    let observed: boolean;

    beforeEach(async () => {
        observed = false;
        validated = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Private', schema: z.object({ count: z.number() }), authorization: { authenticated: true },
            validate: () => { validated = true; return []; },
            observe: () => { observed = true; return new CurrentValueSubject<number>(); }
        })] });
        const session = await server.openObservableQuery('Private', {}, observableExecution());
        authorized = session.rejection?.isAuthorized;
        await server.dispose();
    });

    it('should reject authorization', () => { authorized?.should.equal(false); });
    it('should not validate', () => { validated.should.equal(false); });
    it('should not create a source', () => { observed.should.equal(false); });
});

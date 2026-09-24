// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcScenario } from '@cratis/arc.testing';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';

should();

describe('when collecting observable emissions through an Arc scenario', () => {
    let first: number | undefined;
    let second: number | undefined;

    beforeEach(async () => {
        const subject = CurrentValueSubject.of(1);
        const scenario = new ArcScenario({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => subject
        })] } as unknown as ConstructorParameters<typeof ArcScenario>[0]);
        const session = await scenario.observeQuery('Numbers', {});
        const stream = session.results();
        first = (await stream.next()).value?.data;
        subject.next(2);
        second = (await stream.next()).value?.data;
        await stream.return(undefined);
        await scenario.dispose();
    });

    it('should collect the first emission', () => { first?.should.equal(1); });
    it('should collect later emissions', () => { second?.should.equal(2); });
});

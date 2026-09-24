// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { trackedSource } from '../../queries/observable/for_ObservableQuerySession/given/a_tracked_source.js';

should();

describe('when handling an observable snapshot with completion before first value', () => {
    let status: number | undefined;
    let failure: boolean;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>();
        const tracked = trackedSource(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Number', schema: z.object({}), observe: () => tracked
        })] });
        const pending = server.handle(new Request('http://localhost/api/number?waitForFirstResult=true'));
        await tracked.opened();
        subject.complete();
        const response = await pending;
        status = response?.status;
        failure = (await response!.json()).hasExceptions;
        await server.dispose();
    });

    it('should report a server error', () => { status?.should.equal(500); });
    it('should report an exception', () => { failure.should.be.true; });
});

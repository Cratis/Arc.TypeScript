// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { trackedSource } from '../../queries/observable/for_ObservableQuerySession/given/a_tracked_source.js';

should();

describe('when handling an observable snapshot with wait for first result', () => {
    let timeoutStatus: number | undefined;
    let timeoutFailure: boolean;
    let resultStatus: number | undefined;
    let data: number;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>();
        const tracked = trackedSource(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Number', schema: z.object({}), observe: () => tracked
        })], development: true });
        const timeout = await server.handle(new Request('http://localhost/api/number?waitForFirstResult=true&waitForFirstResultTimeout=0.01'));
        timeoutStatus = timeout?.status;
        timeoutFailure = (await timeout!.json()).hasExceptions;
        const pending = server.handle(new Request('http://localhost/api/number?waitForFirstResult=true'));
        await tracked.opened();
        subject.next(42);
        const response = await pending;
        resultStatus = response?.status;
        data = (await response!.json()).data;
        await server.dispose();
    });

    it('should time out when no value arrives', () => { timeoutStatus?.should.equal(408); });
    it('should mark a timed-out wait as a failure', () => { timeoutFailure.should.equal(true); });
    it('should succeed after a value arrives', () => { resultStatus?.should.equal(200); });
    it('should return the first value', () => { data.should.equal(42); });
});

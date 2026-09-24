// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { trackedSource } from './given/a_tracked_source.js';

should();

describe('when waiting for one HTTP result', () => {
    let status: number | undefined;
    let data: number;
    let active: number;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>();
        const tracked = trackedSource(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const pending = server.handle(new Request('http://localhost/api/value?waitForFirstResult=True'));
        await tracked.opened();
        subject.next(3);
        const response = await pending;
        status = response?.status;
        data = (await response!.json()).data;
        active = tracked.count();
        await server.dispose();
    });

    it('should return success', () => { status?.should.equal(200); });
    it('should return the first value', () => { data.should.equal(3); });
    it('should unsubscribe the source', () => { active.should.equal(0); });
});

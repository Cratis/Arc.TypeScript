// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { trackedSource } from './given/a_tracked_source.js';

should();

describe('when canceling SSE with a queued emission', () => {
    let active: number;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>(1);
        const tracked = trackedSource(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const response = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        await reader.read();
        subject.next(2);
        await reader.cancel();
        active = tracked.count();
        await server.dispose();
    });

    it('should unsubscribe the source', () => { active.should.equal(0); });
});

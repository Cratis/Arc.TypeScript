// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, serviceToken } from '../../../index.js';
import type { ObservableEmissionGuard } from '../ObservableEmissionGuard.js';
import { ObservableEmissionDecision } from '../ObservableEmissionDecision.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { trackedSource } from './given/a_tracked_source.js';

should();

describe('when an emission guard denies and terminates SSE', () => {
    let authorized: boolean;
    let finished: boolean | undefined;
    let active: number;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>(1);
        const tracked = trackedSource(subject);
        const guard = serviceToken<ObservableEmissionGuard>('deny second');
        const server = new ArcServer({ services: [{ token: guard, lifetime: 'scoped', factory: (): ObservableEmissionGuard => ({
            check: emission => emission.data === 2 ? ObservableEmissionDecision.DenyAndTerminate : ObservableEmissionDecision.Allow
        }) }], observableEmissionGuards: [guard], observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const response = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        await reader.read();
        subject.next(2);
        const terminal = new TextDecoder().decode((await reader.read()).value);
        authorized = JSON.parse(terminal.slice(6)).isAuthorized;
        finished = (await reader.read()).done;
        active = tracked.count();
        await server.dispose();
    });

    it('should deny the terminal emission', () => { authorized.should.be.false; });
    it('should complete the stream', () => { finished?.should.be.true; });
    it('should unsubscribe the source', () => { active.should.equal(0); });
});

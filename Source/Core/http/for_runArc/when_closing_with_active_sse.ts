// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { runArc } from '../runArc.js';
import { eventually, portOf } from './given/a_node_host.js';

should();

describe('when closing with an active SSE stream', () => {
    let contentType: string | null;
    let first: string;
    let second: string;
    let beforeClose: number;
    let afterClose: number;

    beforeEach(async () => {
        const values = CurrentValueSubject.of<number[]>([1]);
        let observers = 0;
        const source = { current: () => values.current(), subscribe: (observer: Parameters<typeof values.subscribe>[0]) => {
            observers++;
            const subscription = values.subscribe(observer);
            return { unsubscribe: () => { observers--; subscription.unsubscribe(); } };
        } };
        const arc = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => source })] });
        const host = await runArc(arc, { port: 0 });
        try {
            const response = await fetch(`http://127.0.0.1:${portOf(host.server)}/api/numbers`, { headers: { accept: 'text/event-stream' } });
            contentType = response.headers.get('content-type');
            const reader = response.body!.getReader();
            first = new TextDecoder().decode((await reader.read()).value);
            values.next([2]);
            second = new TextDecoder().decode((await reader.read()).value);
            beforeClose = observers;
            await host.close({ timeoutMs: 500 });
            await reader.read().catch(() => undefined);
            await eventually(() => observers === 0);
            afterClose = observers;
        } finally { await host.close(); await arc.dispose(); }
    });

    it('should use the SSE content type', () => { contentType?.should.contain('text/event-stream'); });
    it('should stream the first frame', () => { first.should.contain('"data":[1]'); });
    it('should stream the later frame', () => { second.should.contain('"data":[2]'); });
    it('should retain the subscription before shutdown', () => { beforeClose.should.equal(1); });
    it('should unsubscribe during shutdown', () => { afterClose.should.equal(0); });
});

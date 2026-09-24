// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../../ArcServer.js';
import { Severity } from '../../../../validation/Severity.js';
import { defineObservableQuery } from '../../defineObservableQuery.js';
import { directWebSocket } from '../../directWebSocket.js';
import type { WebSocketTransport } from '../../WebSocketTransport.js';

should();

describe('when the direct socket closes while observe is opening', () => {
    let signal: AbortSignal | undefined;
    let completed: Promise<void>;
    let server: ArcServer;
    let controller: AbortController;

    beforeEach(async () => {
        controller = new AbortController();
        let started: () => void = () => {};
        const opening = new Promise<void>(resolve => { started = resolve; });
        server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Pending', schema: z.object({}), observe: (_input, context) => {
                signal = context.signal;
                started();
                return new Promise(resolve => context.signal.addEventListener('abort', () => resolve((async function* () {})())));
            }
        })] });
        const transport = {
            signal: controller.signal,
            send: async () => {},
            close: () => controller.abort(),
            async *[Symbol.asyncIterator]() {
                if (!controller.signal.aborted)
                    await new Promise(resolve => controller.signal.addEventListener('abort', resolve));
                yield* [];
            }
        } as unknown as WebSocketTransport;
        const context = { correlationId: crypto.randomUUID(), signal: new AbortController().signal,
            allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined };
        completed = directWebSocket(server, new Request('http://arc.invalid/api/pending'), transport,
            undefined, { context, authenticationFailed: false });
        await opening;
        controller.abort();
        await completed;
    });

    afterEach(async () => { await server.dispose(); });

    it('should abort the query signal', () => {
        should().equal(signal?.aborted, true);
    });
});

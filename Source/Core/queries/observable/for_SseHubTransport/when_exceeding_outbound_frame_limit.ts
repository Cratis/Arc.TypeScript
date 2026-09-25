// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SseHubTransport } from '../SseHubTransport.js';
import { HubFrameType } from '../HubFrameType.js';
import { ObservableLimits } from '../ObservableLimits.js';

should();

describe('when exceeding the SSE outbound frame limit', () => {
    let output: SseHubTransport;
    let outcomes: PromiseSettledResult<void>[];

    beforeEach(async () => {
        output = new SseHubTransport(new ObservableLimits({ query: { maxObservableOutboundFrames: 64 } }));
        await output.send({ type: HubFrameType.Connected });
        const waiting = Array.from({ length: 64 }, () => output.send({ type: HubFrameType.QueryResult }));
        outcomes = await Promise.allSettled([...waiting, output.send({ type: HubFrameType.QueryResult })]);
    });

    it('should reject the 65th pending frame', () => { outcomes[64]?.status.should.equal('rejected'); });
    it('should abort the connection', () => { output.signal.aborted.should.equal(true); });
});

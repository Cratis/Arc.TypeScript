// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import type { ArcOptions } from '../../ArcOptions.js';

should();

describe('when configuring observable transport with invalid budgets', () => {
    let invalidOptions: ArcOptions[];

    beforeEach(() => {
        invalidOptions = [
            { query: { maxObservableSubscriptions: 0 } }, { query: { maxObservableSubscriptionsPerCaller: 0 } },
            { query: { maxObservableHubConnections: 0 } }, { query: { maxObservableHubConnectionsPerCaller: 0 } },
            { query: { maxObservableHubSubscriptionsPerConnection: 0 } }, { query: { maxObservableInboundFrames: 0 } },
            { query: { maxObservableOutboundFrames: 0 } }, { query: { maxObservablePendingEmissions: 0 } },
            { query: { maxObservableInboundFrameBytes: 0 } }, { query: { maxObservableOutboundFrameBytes: 0 } },
            { query: { maxObservableTombstones: 0 } }, { query: { observableHandshakeTimeoutMs: 0 } }
        ];
    });

    it('should reject every invalid budget before registering routes', () => {
        for (const option of invalidOptions) (() => new ArcServer(option)).should.throw(/Invalid/);
    });
});

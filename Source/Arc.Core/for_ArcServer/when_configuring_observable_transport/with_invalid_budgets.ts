// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';

should();

describe('when configuring observable transport with invalid budgets', () => {
    let invalidOptions: Record<string, number>[];

    beforeEach(() => {
        invalidOptions = [
            { maxObservableSubscriptions: 0 }, { maxObservableSubscriptionsPerCaller: 0 },
            { maxObservableHubConnections: 0 }, { maxObservableHubConnectionsPerCaller: 0 },
            { maxObservableHubSubscriptionsPerConnection: 0 }, { maxObservableInboundFrames: 0 },
            { maxObservableOutboundFrames: 0 }, { maxObservablePendingEmissions: 0 },
            { maxObservableInboundFrameBytes: 0 }, { maxObservableOutboundFrameBytes: 0 },
            { maxObservableTombstones: 0 }, { observableHandshakeTimeoutMs: 0 }
        ];
    });

    it('should reject every invalid budget before registering routes', () => {
        for (const option of invalidOptions) (() => new ArcServer(option)).should.throw(/Invalid/);
    });
});

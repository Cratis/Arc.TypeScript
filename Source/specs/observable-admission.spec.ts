// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { ArcServer, Severity } from '../src/index.js';
import type { ExecutionContext } from '../src/index.js';
import { observableCallerKey } from '../src/queries/observable/observableCallerKey.js';

should();
const anonymous = (): ExecutionContext => ({ correlationId: crypto.randomUUID(), principal: undefined,
    tenantId: 'tenant', allowedSeverity: Severity.Warning, signal: new AbortController().signal });

describe('observable subscription admission identity', () => {
    it('should distinguish anonymous connections and authenticated principals named anonymous', () => {
        const first = { ...anonymous(), connectionId: 'first', remoteAddress: '10.0.0.1' };
        const second = { ...anonymous(), connectionId: 'second', remoteAddress: '10.0.0.1' };
        const named = { ...anonymous(), principal: { id: 'anonymous', isAuthenticated: true, roles: [] } };
        observableCallerKey(first).should.not.equal(observableCallerKey(second));
        observableCallerKey(first).should.not.equal(observableCallerKey(named));
        observableCallerKey(first, false).should.equal(observableCallerKey(second, false));
    });

    it('should validate every configured transport budget before registering routes', () => {
        for (const option of [
            { maxObservableSubscriptions: 0 }, { maxObservableSubscriptionsPerCaller: 0 },
            { maxObservableHubConnections: 0 }, { maxObservableHubConnectionsPerCaller: 0 },
            { maxObservableHubSubscriptionsPerConnection: 0 }, { maxObservableInboundFrames: 0 },
            { maxObservableOutboundFrames: 0 }, { maxObservablePendingEmissions: 0 },
            { maxObservableInboundFrameBytes: 0 }, { maxObservableOutboundFrameBytes: 0 },
            { maxObservableTombstones: 0 }, { observableHandshakeTimeoutMs: 0 }
        ]) should().throw(() => new ArcServer(option), /Invalid/);
    });
});

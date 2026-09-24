// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { Severity } from '../../../../validation/Severity.js';
import type { ExecutionContext } from '../../../../execution/ExecutionContext.js';
import { observableCallerKey } from '../../observableCallerKey.js';

should();

describe('when identifying callers with anonymous connections', () => {
    let first: string;
    let second: string;
    let named: string;
    let shared: string;
    let otherShared: string;

    beforeEach(() => {
        const anonymous = (): ExecutionContext => ({ correlationId: crypto.randomUUID(), principal: undefined,
            tenantId: 'tenant', allowedSeverity: Severity.Warning, signal: new AbortController().signal });
        const one = { ...anonymous(), connectionId: 'first', remoteAddress: '10.0.0.1' };
        const two = { ...anonymous(), connectionId: 'second', remoteAddress: '10.0.0.1' };
        first = observableCallerKey(one);
        second = observableCallerKey(two);
        named = observableCallerKey({ ...anonymous(), principal: { id: 'anonymous', isAuthenticated: true, roles: [] } });
        shared = observableCallerKey(one, false);
        otherShared = observableCallerKey(two, false);
    });

    it('should distinguish anonymous connections', () => { first.should.not.equal(second); });
    it('should distinguish authenticated principals named anonymous', () => { first.should.not.equal(named); });
    it('should share a key when connection identity is disabled', () => { shared.should.equal(otherShared); });
});

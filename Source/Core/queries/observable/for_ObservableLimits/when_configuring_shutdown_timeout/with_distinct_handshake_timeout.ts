// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableLimits } from '../../ObservableLimits.js';

should();

describe('when configuring the hub shutdown timeout independently', () => {
    let limits: ObservableLimits;

    beforeEach(() => {
        limits = new ObservableLimits({ query: { observableHandshakeTimeoutMs: 125, observableShutdownTimeoutMs: 300 },  });
    });

    it('should keep the handshake timeout unchanged', () => {
        should().equal(limits.handshakeTimeoutMs, 125);
    });

    it('should use the separate shutdown deadline', () => {
        should().equal(limits.shutdownTimeoutMs, 300);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '@cratis/arc.core';
import { ChronicleClient } from '@cratis/chronicle';
import sinon from 'sinon';
import { ChronicleArtifacts } from '../ChronicleArtifacts.js';
import { ChronicleRuntime } from '../ChronicleRuntime.js';

describe('when disposing an Arc-owned Chronicle client twice', () => {
    let dispose: sinon.SinonStub;
    beforeEach(() => {
        dispose = sinon.stub(ChronicleClient.prototype, 'dispose');
        const runtime = new ChronicleRuntime({ connectionString: 'chronicle://localhost:35000', eventStore: 'Orders' },
            new ChronicleArtifacts(), () => ({}) as ArcServer);
        runtime[Symbol.dispose]();
        runtime[Symbol.dispose]();
    });
    afterEach(() => dispose.restore());
    it('should close the client once', () => { dispose.callCount.should.equal(1); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel, service, snapshotStreamSource } from '@cratis/arc.core';
import { Observable } from 'rxjs';
import { QueryScenario } from '../../QueryScenario.js';

const failingScopeDisposal = vi.fn(() => { throw new Error('scope cleanup failed'); });
class FailingScopeService {
    [Symbol.dispose](): void { failingScopeDisposal(); }
}
class FailingStream extends Observable<number> {
    [Symbol.dispose](): void { throw new Error('stream cleanup failed'); }
}
const stream = new FailingStream();
@readModel()
class SnapshotWithFailingCleanup {
    @query({}, service(FailingScopeService))
    static find(_service: FailingScopeService) { void _service; return stream; }
}

describe('when both snapshot stream and scoped service cleanup fail in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        failingScopeDisposal.mockClear();
        scenario = QueryScenario.for(SnapshotWithFailingCleanup, 'find');
        scenario.services.addScoped(FailingScopeService, () => new FailingScopeService());
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should find the rejected snapshot stream through nested cleanup failures', () => {
        (snapshotStreamSource(result) === stream).should.equal(true);
    });
    it('should report both cleanup failures', () => {
        result.exceptionMessages.join(' ').should.contain('stream cleanup failed');
        failingScopeDisposal.mock.calls.should.have.lengthOf(1);
        result.exceptionMessages.join(' ').should.contain('Service disposal failed');
    });
});

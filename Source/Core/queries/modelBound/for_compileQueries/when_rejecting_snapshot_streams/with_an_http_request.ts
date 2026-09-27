// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { FetchArcApplication } from '../../../../FetchArcApplication.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';

const unsubscribe = vi.fn();
@readModel()
class SnapshotHttp {
    @query() static stream() { return { subscribe: () => ({ unsubscribe }) }; }
}

describe('when a snapshot query returns a stream over HTTP', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        unsubscribe.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/stream'));
            body = await response.json();
        } finally { await application.dispose(); }
    });
    it('should close the subscription exactly once', () => { unsubscribe.mock.calls.should.have.lengthOf(1); });
    it('should report the snapshot rejection', () => {
        response.status.should.equal(500);
        body.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

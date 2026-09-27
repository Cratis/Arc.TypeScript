// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable } from 'rxjs';
import { FetchArcApplication } from '../../../../FetchArcApplication.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';

const started = vi.fn();
const release = vi.fn();
const failingRelease = vi.fn(() => { throw new Error('HTTP cleanup failed'); });
let abortRequest: AbortController;
const abortingRelease = vi.fn(() => { abortRequest.abort(); throw new Error('aborted HTTP cleanup failed'); });
@readModel()
class SnapshotHttp {
    @query() static stream() { return new Observable<number>(() => { started(); }); }
    @query() static owned() { return { subscribe: () => ({}), dispose: release }; }
    @query() static failing() { return { subscribe: () => ({}), dispose: failingRelease }; }
    @query() static aborting() { return { subscribe: () => ({}), dispose: abortingRelease }; }
}

describe('when a snapshot query returns a stream over HTTP', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        started.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/stream'));
            body = await response.json();
        } finally { await application.dispose(); }
    });
    it('should not start the rejected producer', () => { started.mock.calls.should.have.lengthOf(0); });
    it('should report the snapshot rejection', () => {
        response.status.should.equal(500);
        body.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when a snapshot query returns a disposable stream over HTTP', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        release.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/owned'));
            body = await response.json();
        } finally { await application.dispose(); }
    });
    it('should release the source exactly once', () => { release.mock.calls.should.have.lengthOf(1); });
    it('should report the snapshot rejection', () => {
        response.status.should.equal(500);
        body.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when snapshot stream release fails over HTTP', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        failingRelease.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/failing'));
            body = await response.json();
        } finally { await application.dispose(); }
    });
    it('should attempt release exactly once', () => { failingRelease.mock.calls.should.have.lengthOf(1); });
    it('should serialize both the rejection and the release failure', () => {
        response.status.should.equal(500);
        body.exceptionMessages.join(' ').should.contain('returned an observable');
        body.exceptionMessages.join(' ').should.contain('HTTP cleanup failed');
    });
});

describe('when an HTTP request aborts during snapshot stream release', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        abortRequest = new AbortController();
        abortingRelease.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/aborting', { signal: abortRequest.signal }));
            body = await response.json();
        } finally { await application.dispose(); }
    });
    it('should attempt release exactly once', () => { abortingRelease.mock.calls.should.have.lengthOf(1); });
    it('should report both the rejection and release failure despite cancellation', () => {
        abortRequest.signal.aborted.should.equal(true);
        response.status.should.equal(500);
        body.exceptionMessages.join(' ').should.contain('returned an observable');
        body.exceptionMessages.join(' ').should.contain('aborted HTTP cleanup failed');
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable } from 'rxjs';
import { service } from '../../../../dependencyInjection/service.js';
import { ServiceLifetime } from '../../../../dependencyInjection/ServiceLifetime.js';
import { FetchArcApplication } from '../../../../FetchArcApplication.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';

const started = vi.fn();
const release = vi.fn();
const failingRelease = vi.fn(() => { throw new Error('HTTP cleanup failed'); });
let abortRequest: AbortController;
const abortingRelease = vi.fn(() => { abortRequest.abort(); throw new Error('aborted HTTP cleanup failed'); });
const scopedDispose = vi.fn();
const transientDispose = vi.fn();
const transientInstances: TransientStream[] = [];
const singletonDispose = vi.fn();
class ScopedStream {
    subscribe() { return {}; }
    [Symbol.dispose]() { scopedDispose(); }
}
class TransientStream {
    subscribe() { return {}; }
    readonly dispose = vi.fn(() => transientDispose());
    [Symbol.dispose]() { this.dispose(); }
}
class SingletonStream {
    subscribe() { return {}; }
    [Symbol.dispose]() { singletonDispose(); }
}
let finishLateRelease: (error: Error) => void;
const lateRelease = vi.fn(() => new Promise<void>((_, reject) => { finishLateRelease = reject; }));
@readModel()
class SnapshotHttp {
    @query() static stream() { return new Observable<number>(() => { started(); }); }
    @query() static owned() { return { subscribe: () => ({}), dispose: release }; }
    @query() static failing() { return { subscribe: () => ({}), dispose: failingRelease }; }
    @query() static aborting() { return { subscribe: () => ({}), dispose: abortingRelease }; }
    @query(service(ScopedStream)) static scoped(stream: ScopedStream) { return stream; }
    @query(service(TransientStream)) static transient(stream: TransientStream) { return stream; }
    @query(service(SingletonStream)) static singleton(stream: SingletonStream) { return stream; }
    @query() static late() { return { subscribe: () => ({}), [Symbol.asyncDispose]: lateRelease }; }
}
const services = [
    { token: ScopedStream, lifetime: ServiceLifetime.Scoped, factory: () => new ScopedStream() },
    { token: TransientStream, lifetime: ServiceLifetime.Transient, factory: () => {
        const instance = new TransientStream();
        transientInstances.push(instance);
        return instance;
    } },
    { token: SingletonStream, lifetime: ServiceLifetime.Singleton, factory: () => new SingletonStream() }
];

describe('when a snapshot query returns an Arc-owned scoped or transient stream over HTTP', () => {
    let statuses: number[];
    beforeEach(async () => {
        scopedDispose.mockClear(); transientDispose.mockClear(); transientInstances.length = 0;
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
        try {
            statuses = [];
            for (const name of ['scoped', 'transient'])
                statuses.push((await application.fetch(new Request(`https://example.test/api/${name}`))).status);
        } finally { await application.dispose(); }
    });
    it('should let each request scope dispose its own stream exactly once', () => {
        scopedDispose.mock.calls.should.have.lengthOf(1);
        transientDispose.mock.calls.should.have.lengthOf(transientInstances.length);
        transientInstances.forEach(instance => instance.dispose.mock.calls.should.have.lengthOf(1));
    });
    it('should reject both snapshot streams', () => { statuses.should.deep.equal([500, 500]); });
});

describe('when a snapshot query returns an Arc-owned singleton stream over HTTP', () => {
    let response: Response;
    let beforeShutdown: number;
    beforeEach(async () => {
        singletonDispose.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/singleton'));
            beforeShutdown = singletonDispose.mock.calls.length;
        } finally { await application.dispose(); }
    });
    it('should not dispose the singleton during the request', () => { beforeShutdown.should.equal(0); });
    it('should dispose the singleton at registry shutdown only', () => { singletonDispose.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { response.status.should.equal(500); });
});

describe('when snapshot cleanup fails after the deadline over HTTP', () => {
    let response: Response;
    let logged: unknown[];
    beforeEach(async () => {
        logged = [];
        lateRelease.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services,
            logger: error => { logged.push(error); } }).add(SnapshotHttp).build();
        try {
            response = await application.fetch(new Request('https://example.test/api/late'));
            finishLateRelease(new Error('late HTTP cleanup failed'));
            await new Promise(resolve => setTimeout(resolve, 0));
        } finally { await application.dispose(); }
    });
    it('should report the timeout with the snapshot rejection', async () => {
        const body = await response.json() as { exceptionMessages: string[] };
        body.exceptionMessages.join(' ').should.contain('did not respond to cleanup');
    });
    it('should report the later failure to the server logger', () => {
        logged.some(error => error instanceof Error && error.message === 'late HTTP cleanup failed').should.equal(true);
    });
});

describe('when a snapshot query returns a stream over HTTP', () => {
    let response: Response;
    let body: { exceptionMessages: string[] };
    beforeEach(async () => {
        started.mockClear();
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
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
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
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
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
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
        const application = await FetchArcApplication.createBuilder({ exposeExceptionDetails: true, services }).add(SnapshotHttp).build();
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

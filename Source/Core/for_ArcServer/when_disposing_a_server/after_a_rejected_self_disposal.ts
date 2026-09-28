// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when owned work attempts server disposal before external shutdown', () => {
    let failure: unknown;
    let disposed: boolean;
    beforeEach(async () => {
        const server = new ArcServer({});
        const scope = server.services.createScope(serviceContext('tenant'));
        try {
            failure = await beforeDeadline(captureFailure(server.runInScope(scope, () => server.dispose())), 'self disposal');
            await beforeDeadline(server.dispose(), 'external server disposal');
            disposed = server.services.disposed;
        } finally { await scope.dispose(); }
    });
    it('should reject the self-join and still dispose from outside', () => {
        (failure as Error).message.should.match(/Cannot await service registry disposal from owned work/);
        disposed.should.equal(true);
    });
});

describe('when a participant registers during an already started server disposal', () => {
    let failure: unknown;
    beforeEach(async () => {
        const server = new ArcServer({});
        const entered = gate(); const release = gate();
        server.closeWebSockets = async () => { entered.release(); await release.promise; };
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'transport teardown entry');
            failure = await captureFailure(Promise.resolve().then(() => server.services.addShutdownParticipant({
                stop: () => {}, drain: async () => {}
            })));
            release.release();
            await beforeDeadline(closing, 'server shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('should reject the late participant before transport teardown completes', () => {
        (failure as Error).message.should.equal('Service registry is disposed');
    });
});

describe('when owned work joins an already started server disposal', () => {
    let failure: unknown;
    beforeEach(async () => {
        const server = new ArcServer({});
        const scope = server.services.createScope(serviceContext('tenant'));
        const entered = gate(); const release = gate();
        const work = server.runInScope(scope, async () => {
            entered.release(); await release.promise;
            return server.dispose();
        });
        try {
            await beforeDeadline(entered.promise, 'borrowed execution entry');
            const closing = server.dispose();
            release.release();
            failure = await beforeDeadline(captureFailure(work), 'borrowed self-join');
            await beforeDeadline(closing, 'external shutdown after self-join');
        } finally { release.release(); await scope.dispose(); }
    });
    it('should reject the cached shutdown from inside owned work', () => {
        (failure as Error).message.should.match(/Cannot await service registry disposal from owned work/);
    });
});

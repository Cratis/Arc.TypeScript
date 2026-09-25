// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when retrying a scoped factory with a detached attempt', () => {
    let firstFailure: unknown; let success: boolean; let tenant: unknown; let attempts: number;
    beforeEach(async () => {
        const token = serviceToken<{ tenant: string | undefined }>('retried scoped');
        const releaseRetry = gate(); let retry: Promise<{ tenant: string | undefined }> | undefined;
        attempts = 0;
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: (resolver, identity) => {
            attempts++;
            if (attempts === 1) {
                retry = (async () => { await releaseRetry.promise; return resolver.resolve(token); })();
                throw new Error('first attempt failed');
            }
            return { tenant: identity.tenantId };
        } }], queries: [defineQuery({ name: 'Retry', schema: z.object({}), perform: async () => {
            firstFailure = await captureFailure(currentServices().resolve(token));
            releaseRetry.release();
            return (await beforeDeadline(retry!, 'detached scoped retry')).tenant;
        } })] });
        try {
            const result = await beforeDeadline(server.performQuery('Retry', {}, serviceContext('alpha')), 'failed scoped retry');
            success = result.isSuccess; tenant = result.data;
        } finally { releaseRetry.release(); await beforeDeadline(server.dispose(), 'failed scoped retry disposal'); }
    });
    it('should reject the first attempt and let a detached retry create a fresh instance', () => {
        (firstFailure as Error).message.should.match(/Service factory failed: retried scoped/);
        success.should.equal(true); (tenant as string).should.equal('alpha');
        attempts.should.equal(2);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { Severity } from '../../validation/Severity.js';

should();
describe('when entering nested executions with a custom tenant resolver', () => {
    let httpData: unknown;
    let nestedData: unknown;
    let after: unknown;
    beforeEach(async () => {
        const server = new ArcServer({ resolveTenant: () => undefined, queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, ctx) => [ctx.tenantId, currentContext()?.tenantId] })] });
        httpData = (await (await server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': 'forged' } })))!.json()).data;
        const outer = new ArcServer({ commands: [defineCommand({ name: 'Outer', schema: z.object({}), handle: async () => {
            const before = currentContext();
            await server.performQuery('Tenant', {}, { correlationId: crypto.randomUUID(), tenantId: 'inner', principal: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal });
            return [before?.tenantId, currentContext()?.tenantId, Object.isFrozen(before)];
        } })] });
        nestedData = (await outer.executeCommand('Outer', {}, { correlationId: crypto.randomUUID(), tenantId: 'outer', principal: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal })).response;
        after = currentContext();
        await Promise.all([server.dispose(), outer.dispose()]);
    });
    it('should not fall back to the untrusted tenant header', () => httpData!.should.deep.equal([null, null]));
    it('should restore the frozen outer execution context after nesting', () => nestedData!.should.deep.equal(['outer', 'outer', true]));
    it('should clear ambient context after execution', () => (after === undefined).should.equal(true));
});

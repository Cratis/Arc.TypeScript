// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when selecting HTTP severity with untrusted headers', () => {
    let rejectedError: { status: number; message: string };
    let forbidden: number;
    let query: number;
    let warnings: number[];
    let accepted: { status: number; response: unknown }[];
    let direct: { success: boolean; response: unknown };
    let handled: number;
    beforeEach(async () => {
        handled = 0;
        const server = new ArcServer({ commands: [
            defineCommand({ name: 'Business', schema: z.object({}), validate: () => [validation('blocked', [], 'rule', Severity.Error)], handle: () => ++handled }),
            defineCommand({ name: 'Warning', schema: z.object({}), validate: () => [validation('warning', [], 'rule', Severity.Warning)], handle: (_input, ctx) => { handled++; return ctx.allowedSeverity; } }),
            defineCommand({ name: 'Protected', schema: z.object({}), authorize: () => false, handle: () => ++handled })
        ], queries: [defineQuery({ name: 'Read', schema: z.object({}), validate: () => [validation('blocked', [], 'rule', Severity.Error)], perform: () => ++handled })] });
        const business = (await server.handle(runtimePost('/api/business', {}, { 'X-Allowed-Severity': '3' })))!;
        rejectedError = { status: business.status, message: (await business.json()).validationResults[0].message };
        forbidden = (await server.handle(runtimePost('/api/protected', {}, { 'X-Allowed-Severity': '3' })))!.status;
        query = (await server.handle(new Request('http://arc.invalid/api/read', { headers: { 'X-Allowed-Severity': '3' } })))!.status;
        warnings = await Promise.all(['0', '1'].map(async header => (await server.handle(runtimePost('/api/warning', {}, { 'X-Allowed-Severity': header })))!.status));
        accepted = [];
        for (const header of ['2', 'unknown']) {
            const response = (await server.handle(runtimePost('/api/warning', {}, { 'X-Allowed-Severity': header })))!;
            accepted.push({ status: response.status, response: (await response.json()).response });
        }
        const result = await server.executeCommand('Business', {}, { correlationId: crypto.randomUUID(), tenantId: 'trusted', principal: undefined, allowedSeverity: Severity.Error, signal: new AbortController().signal });
        direct = { success: result.isSuccess, response: result.response };
        await server.dispose();
    });
    it('should block an error despite a forged HTTP header', () => rejectedError.should.deep.equal({ status: 400, message: 'blocked' }));
    it('should keep authorization and query validation independent from the header', () => {
        forbidden.should.equal(403);
        query.should.equal(400);
    });
    it('should reject lower allowed severity values', () => warnings.should.deep.equal([400, 400]));
    it('should cap HTTP severity at Warning including invalid values', () => accepted.should.deep.equal([
        { status: 200, response: Severity.Warning }, { status: 200, response: Severity.Warning }]));
    it('should not run blocked handlers or queries', () => handled.should.equal(3));
    it('should honor a trusted direct context', () => direct.should.deep.equal({ success: true, response: 3 }));
});

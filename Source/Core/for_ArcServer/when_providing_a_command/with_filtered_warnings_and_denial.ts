// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { denied, rejected } from '../../commands/Outcome.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when providing a command with filtered warnings and denial', () => {
    let unauthorized: boolean;
    let allowed: unknown;
    let forbidden: number;
    let provided: unknown;
    let handled: number;
    beforeEach(async () => {
        handled = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), authorize: () => false,
            provide: () => rejected(validation('warning', [], 'warning', Severity.Warning)), handle: () => ++handled })] });
        unauthorized = (await (await server.handle(runtimePost('/api/save', {}, { 'X-Allowed-Severity': '3' })))!.json()).isAuthorized;
        const permitted = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}),
            provide: () => rejected(validation('warning', [], 'warning', Severity.Warning)), handle: (_input, _context, value) => { provided = value; return ++handled; } })] });
        allowed = (await (await permitted.handle(runtimePost('/api/save', {})))!.json()).response;
        const blocked = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), provide: () => denied(), handle: () => ++handled })] });
        forbidden = (await blocked.handle(runtimePost('/api/save', {}, { 'X-Allowed-Severity': '3' })))!.status;
        await Promise.all([server.dispose(), permitted.dispose(), blocked.dispose()]);
    });
    it('should enforce authorization independently from allowed severity', () => unauthorized.should.equal(false));
    it('should filter a permitted provider warning before handling', () => {
        (provided === undefined).should.equal(true);
        allowed!.should.equal(1);
    });
    it('should preserve a provider denial regardless of severity', () => {
        forbidden.should.equal(403);
        handled.should.equal(1);
    });
});

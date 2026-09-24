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
describe('when validating operations with a failing validator', () => {
    let status: number;
    let result: { validationResults: { reason: string }[] };
    let wire: string;
    let queryStatus: number;
    const logged: unknown[] = [];
    beforeEach(async () => {
        logged.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error('secret'); }, handle: () => 1 })],
            queries: [defineQuery({ name: 'List', schema: z.object({}), validate: () => [validation('bad', [], 'rule', Severity.Error)], perform: () => 1 })], logger: error => { logged.push(error); } });
        const response = (await server.handle(runtimePost('/api/save', {})))!;
        status = response.status;
        result = await response.json();
        wire = JSON.stringify(result);
        queryStatus = (await server.handle(new Request('http://arc.invalid/api/list', { headers: { 'X-Allowed-Severity': '3' } })))!.status;
        await server.dispose();
    });
    it('should report a validator failure', () => {
        status.should.equal(400);
        result.validationResults[0]!.reason.should.equal('validatorFailed');
    });
    it('should redact secret validator errors from the wire', () => wire.should.not.contain('secret'));
    it('should log the original validator exception', () => (logged[0] as Error).message.should.equal('secret'));
    it('should ignore the command severity header for queries', () => queryStatus.should.equal(400));
});

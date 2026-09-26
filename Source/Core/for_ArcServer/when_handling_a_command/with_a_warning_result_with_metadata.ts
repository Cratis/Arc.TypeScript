// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, ValidationResult } from '../../index.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { rejected } from '../../commands/Outcome.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a command with a warning result with metadata', () => {
    let status: number;
    let result: { validationResults: { state: unknown; reasonDetail: string; severity: number }[] };
    beforeEach(async () => {
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () =>
            rejected(ValidationResult.Warning('The item changed', { members: ['id'], state: { revision: 2 }, reason: 'concurrencyViolation', reasonDetail: 'Item' })) })] });
        const response = (await server.handle(runtimePost('/api/save', {}, { 'X-Allowed-Severity': '0' })))!;
        status = response.status;
        result = await response.json();
        await server.dispose();
    });
    it('should reject the command', () => status.should.equal(400));
    it('should include the warning in the HTTP result', () => result.validationResults[0]!.severity.should.equal(2));
    it('should carry the state in the HTTP result', () => (result.validationResults[0]!.state as { revision: number }).should.deep.equal({ revision: 2 }));
    it('should carry the reason detail in the HTTP result', () => result.validationResults[0]!.reasonDetail.should.equal('Item'));
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { rejected } from '../../commands/Outcome.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when providing a command with a rejection', () => {
    let defaultResult: { validationResults: { message: string }[] };
    let strictResult: { validationResults: { message: string }[] };
    beforeEach(async () => {
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({ value: z.string() }),
            validate: () => [validation('warning', ['value'], 'rule', Severity.Warning)],
            provide: () => rejected(validation('no', ['value'])), handle: () => 'never' })] });
        defaultResult = await (await server.handle(runtimePost('/api/save', { value: 'a' })))!.json();
        strictResult = await (await server.handle(runtimePost('/api/save', { value: 'a' }, { 'X-Allowed-Severity': '1' })))!.json();
        await server.dispose();
    });
    it('should short circuit on the provider rejection', () => defaultResult.validationResults[0]!.message.should.equal('no'));
    it('should filter warnings according to allowed severity', () => strictResult.validationResults[0]!.message.should.equal('warning'));
});

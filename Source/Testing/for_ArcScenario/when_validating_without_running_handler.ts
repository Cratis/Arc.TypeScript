// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { defineCommand } from '@cratis/arc.core';
import { ArcScenario } from '../ArcScenario.js';

describe('when validating a command through a low-level scenario', () => {
    let valid: boolean;
    let executions: number;
    beforeEach(async () => {
        executions = 0;
        const scenario = new ArcScenario({ commands: [defineCommand({ name: 'Submit', schema: z.object({}),
            handle: () => { executions++; return 1; } })] });
        try { valid = (await scenario.validateCommand('Submit', {})).isSuccess; }
        finally { await scenario.dispose(); }
    });
    it('should validate successfully without running the handler', () => {
        valid.should.equal(true);
        executions.should.equal(0);
    });
});

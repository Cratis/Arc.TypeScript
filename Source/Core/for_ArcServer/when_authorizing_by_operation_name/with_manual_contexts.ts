// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import type { CommandContext } from '../../commands/CommandContext.js';
import { CommandContextValues } from '../../commands/CommandContextValues.js';
import type { QueryContext } from '../../queries/QueryContext.js';
should();

describe('when constructing operation contexts without the framework', () => {
    const execution = { correlationId: 'manual', allowedSeverity: 2, principal: undefined, tenantId: undefined,
        signal: new AbortController().signal };
    const command: CommandContext = { ...execution, command: {}, key: undefined, values: new CommandContextValues() };
    const query: QueryContext = { ...execution, query: {}, options: {} };
    it('should leave the optional operation identity absent on a manual command', () => {
        (command.operationName === undefined).should.equal(true);
    });
    it('should leave the optional operation identity absent on a manual query', () => {
        (query.operationName === undefined).should.equal(true);
    });
});

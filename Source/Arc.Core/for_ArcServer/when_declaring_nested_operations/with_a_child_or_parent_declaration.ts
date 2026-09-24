// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { given } from '../../given.js';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandOperation } from '../../commands/CommandOperationDeclaration.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
class Effect extends CommandOperation {
    constructor(private readonly calls: string[]) { super(); }
    execute(signal: AbortSignal): void { void signal; this.calls.push('execute'); }
}
class a_nested_command_boundary {
    readonly calls: string[] = [];
    readonly context = { correlationId: 'nested', allowedSeverity: 2, signal: new AbortController().signal,
        principal: undefined, tenantId: undefined };
    readonly server: ArcServer;
    constructor() {
        this.server = new ArcServer({ commands: [
            defineCommand({ name: 'Child', schema: z.object({}), handle: () => new Effect(this.calls) }),
            defineCommand({ name: 'Parent', schema: z.object({}), handle: async () => {
                await this.server.executeCommand('Child', {}, this.context);
                return new Effect(this.calls);
            } }),
            defineCommand({ name: 'ParentOnly', schema: z.object({}), handle: async () => {
                const child = await this.server.executeCommand('Child', {}, this.context);
                this.calls.push(child.isSuccess ? 'child succeeded' : 'child failed');
                return 'response';
            } })
        ] });
    }
}
describe('when a nested child declares operations', given(a_nested_command_boundary, context => {
    let result: CommandResult;
    beforeEach(async () => { result = await context.server.executeCommand('ParentOnly', {}, context.context); });
    it('should reject the child before executing effects', () => {
        result.isSuccess.should.equal(true);
        context.calls.should.deep.equal(['child failed']);
    });
}));
describe('when a parent declares operations after a nested attempt', given(a_nested_command_boundary, context => {
    let result: CommandResult;
    beforeEach(async () => { result = await context.server.executeCommand('Parent', {}, context.context); });
    it('should reject the parent before executing effects', () => {
        result.isSuccess.should.equal(false);
        context.calls.should.deep.equal([]);
    });
}));

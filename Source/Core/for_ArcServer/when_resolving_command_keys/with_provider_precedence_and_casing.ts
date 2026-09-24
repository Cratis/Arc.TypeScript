// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
const execution = { correlationId: 'key', allowedSeverity: 2, principal: undefined, tenantId: undefined,
    signal: new AbortController().signal };
const values = serviceToken<{ provide(): Record<string, unknown> }>('values');
const key = serviceToken<{ resolve(): string }>('key');
describe('when a values provider supplies an empty resolved key', () => {
    let captured: CommandContext;
    beforeEach(async () => {
        const server = new ArcServer({
            services: [{ token: values, lifetime: 'scoped', factory: () => ({ provide: () => ({ ResolvedKey: '', DisplayName: 1 }) }) },
                { token: key, lifetime: 'scoped', factory: () => ({ resolve: () => 'other' }) }],
            commandContextValuesProviders: [values], commandKeyResolvers: [key],
            commands: [defineCommand({ name: 'Run', schema: z.object({}), handle: (_input, context) => {
                captured = context as CommandContext;
            } })]
        });
        await server.executeCommand('Run', {}, execution);
    });
    it('should keep the explicit empty key and original value casing', () => {
        (captured!.key === undefined).should.equal(true);
        [...captured!.values.keys()].should.deep.equal(['ResolvedKey', 'DisplayName']);
        captured!.values.get('displayname')!.should.equal(1);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, commandContext, inject, key, abortSignal } from '../../index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
@command()
class ResolveCommand {
    @field(String) @key() id!: string;
    @inject(abortSignal(), commandContext())
    handle(signalValue: AbortSignal, commandContext: CommandContext): string {
        return `${commandContext.key}:${commandContext.command === this}:${signalValue === commandContext.signal}`;
    }
}
describe('when resolving command arguments with signal and context', () => {
    let result: { isSuccess: boolean; response: string };
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(ResolveCommand);
        const app = await builder.build();
        try {
            result = await app.server.executeCommand('ResolveCommand', { id: 'abc' }, {
                correlationId: 'resolved', principal: undefined, tenantId: undefined,
                allowedSeverity: 2, signal: new AbortController().signal
            }) as typeof result;
        } finally { await app.dispose(); }
    });
    it('should supply the same command context and abort signal', () => {
        result.isSuccess.should.equal(true);
        result.response.should.equal('abc:true:true');
    });
});

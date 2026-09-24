// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, tuple } from '../../index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
const seen: string[] = [];
class Handler {
    canHandle(context: CommandContext, value: unknown): boolean { void context; return value === 'server-only'; }
    handle(context: CommandContext): void { seen.push(context.correlationId); }
}
@command()
class RunCommand {
    handle() { return tuple('client', 'server-only'); }
}
describe('when registering a response handler with a scoped service', () => {
    let value: string | undefined;
    beforeEach(async () => {
        seen.length = 0;
        const builder = ArcApplication.createBuilder();
        builder.services.addScoped(Handler);
        builder.addCommandResponseValueHandler(Handler).add(RunCommand);
        const application = await builder.build();
        try {
            const result = await application.server.executeCommand('RunCommand', {}, {
                correlationId: 'registered', principal: undefined, tenantId: undefined,
                signal: new AbortController().signal, allowedSeverity: 2
            });
            value = result.response as string;
        } finally { await application.dispose(); }
    });
    it('should execute the handler inside the command scope', () => {
        value!.should.equal('client');
        seen.should.deep.equal(['registered']);
    });
});

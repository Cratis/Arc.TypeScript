// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, commandResponseValueHandler, tuple } from '../../index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
const seen: string[] = [];
@commandResponseValueHandler()
class DiscoveredHandler {
    canHandle(context: CommandContext, value: unknown): boolean { void context; return value === 'server'; }
    handle(context: CommandContext): void { seen.push(context.correlationId); }
}
@command()
class HandleCommand {
    handle() { return tuple('client', 'server'); }
}
describe('when registering a response handler through decorator discovery', () => {
    let response: unknown;
    beforeEach(async () => {
        seen.length = 0;
        const builder = ArcApplication.createBuilder();
        builder.add(DiscoveredHandler, HandleCommand);
        const app = await builder.build();
        try {
            response = (await app.server.executeCommand('HandleCommand', {}, {
                correlationId: 'discovered', principal: undefined, tenantId: undefined,
                signal: new AbortController().signal, allowedSeverity: 2
            })).response;
        } finally { await app.dispose(); }
    });
    it('should consume the value through the discovered handler', () => {
        (response as string).should.equal('client');
        seen.should.deep.equal(['discovered']);
    });
});

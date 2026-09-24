// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, commandContext, inject, provided, tuple } from '../../index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
class First { constructor(readonly value: string) {} }
class Second { constructor(readonly value: string) {} }
@command()
class PreparedCommand {
    provide() { return tuple(new Second('second'), new First('first')); }
    @inject(provided(First), commandContext(), provided(Second))
    handle(first: First, execution: CommandContext, second: Second): string {
        return `${first.value}:${execution.correlationId}:${second.value}`;
    }
}
describe('when resolving command arguments with multiple typed provided values', () => {
    let response: string | undefined;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(PreparedCommand);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('PreparedCommand', {}, {
                correlationId: 'typed', principal: undefined, tenantId: undefined,
                allowedSeverity: 2, signal: new AbortController().signal
            });
            response = result.response as string;
        } finally { await app.dispose(); }
    });
    it('should match the provided values by type at their declared positions', () => {
        response!.should.equal('first:typed:second');
    });
});

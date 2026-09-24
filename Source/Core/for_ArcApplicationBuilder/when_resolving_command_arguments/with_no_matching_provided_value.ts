// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, inject, provided } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
class Needed {}
@command()
class MissingProvided {
    provide(): string { return 'not a number'; }
    @inject(provided(Needed))
    handle(value: Needed): void { void value; }
}
describe('when no provided value matches an injected type', () => {
    let result: CommandResult;
    beforeEach(async () => {
        const app = await ArcApplication.createBuilder().add(MissingProvided).build();
        try { result = await app.server.executeCommand('MissingProvided', {}, {
            correlationId: 'provided', allowedSeverity: 2, principal: undefined, tenantId: undefined,
            signal: new AbortController().signal
        }); } finally { await app.dispose(); }
    });
    it('should fail rather than invoke the handler', () => {
        result.isSuccess.should.equal(false);
        result.exceptionMessages.join().should.contain('No provided value matches Needed');
    });
});

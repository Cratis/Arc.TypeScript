// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when a plain command handler finishes after request cancellation', () => {
    let result: CommandResult;
    beforeEach(async () => {
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const server = new ArcServer({ commands: [defineCommand({ name: 'Run', schema: z.object({}),
            handle: async () => { started.release(); await release.promise; return 'done'; } })] });
        try {
            const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-handler', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            result = await pending;
        } finally { await server.dispose(); }
    });
    it('should preserve the completed handler response', () => {
        result.isSuccess.should.equal(true);
        result.response!.should.equal('done');
    });
});

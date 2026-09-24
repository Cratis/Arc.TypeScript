// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, command, Severity } from '../../index.js';

@command() class RunOnce { handle() { return 'done'; } }

describe('when executing multiple command runners', () => {
    it('should compose them in registration order', async () => {
        const order: string[] = [];
        const builder = ArcApplication.createBuilder();
        builder.addCommandExecutionRunner(async (_context, execute) => {
            order.push('first begins');
            const result = await execute();
            order.push('first ends');
            return result;
        });
        builder.addCommandExecutionRunner(async (_context, execute) => {
            order.push('second begins');
            const result = await execute();
            order.push('second ends');
            return result;
        });
        builder.add(RunOnce);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('RunOnce', {}, { correlationId: crypto.randomUUID(),
                signal: new AbortController().signal, tenantId: 'Default', principal: undefined, allowedSeverity: Severity.Warning });
            result.isSuccess.should.equal(true);
            order.should.deep.equal(['first begins', 'second begins', 'second ends', 'first ends']);
        } finally { await app.dispose(); }
    });
});

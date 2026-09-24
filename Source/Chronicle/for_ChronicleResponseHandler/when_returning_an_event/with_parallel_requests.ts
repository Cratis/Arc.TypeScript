// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { causationManager } from '@cratis/chronicle/auditing';
import { identityProvider } from '@cratis/chronicle/identity';
import { given } from '../../given.js';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning events from concurrent requests', given(a_registered_command, setup => {
    it('should isolate identities and correlations through append', async () => {
        const seen: { source: string; principal: string; correlation: string; name: string }[] = [];
        setup.appendMany.callsFake(async (entries, options) => {
            await new Promise(resolve => setTimeout(resolve, entries[0]!.eventSourceId === 'a' ? 15 : 1));
            seen.push({ source: entries[0]!.eventSourceId, principal: String(identityProvider.getCurrent().subject),
                correlation: String(options?.correlationId),
                name: causationManager.getCurrentChain().find(item => item.type.name === 'Arc.Command')?.properties['Value.name'] ?? '' });
            return entries.map(() => accepted());
        });
        const app = await setup.build();
        try {
            const first = { ...context('tenant-a'), principal: { id: 'alice', name: 'Alice', roles: [], isAuthenticated: true } };
            const second = { ...context('tenant-b'), principal: { id: 'bob', name: 'Bob', roles: [], isAuthenticated: true } };
            const [a, b] = await Promise.all([
                app.server.executeCommand('Create', { id: 'a', name: 'Ada' }, first),
                app.server.executeCommand('Create', { id: 'b', name: 'Grace' }, second)
            ]);
            a.isSuccess.should.equal(true);
            b.isSuccess.should.equal(true);
            seen.should.deep.include({ source: 'a', principal: 'alice', correlation: first.correlationId, name: 'Ada' });
            seen.should.deep.include({ source: 'b', principal: 'bob', correlation: second.correlationId, name: 'Grace' });
        } finally { await app.dispose(); }
    });
}));

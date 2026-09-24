// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { causationManager } from '@cratis/chronicle/auditing';
import { given } from '../../given.js';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning an event from a command with sensitive fields', given(a_registered_command, setup => {
    it('should omit not-audited and PII fields from command causation', async () => {
        let properties: Record<string, string> | undefined;
        setup.appendMany.callsFake(async entries => {
            properties = causationManager.getCurrentChain().find(item => item.type.name === 'Arc.Command')?.properties;
            return entries.map(() => accepted());
        });
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateSensitive', { id: 'source-1',
                confirmation: 'secret-value', personalName: 'personal-value' }, context());
            result.isSuccess.should.equal(true);
            properties!.should.have.property('Value.id', 'source-1');
            properties!.should.not.have.property('Value.confirmation');
            properties!.should.not.have.property('Value.personalName');
        } finally { await app.dispose(); }
    });
}));

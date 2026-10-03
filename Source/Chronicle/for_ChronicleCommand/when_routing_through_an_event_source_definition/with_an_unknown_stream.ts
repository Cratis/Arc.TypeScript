// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { IChronicleClient } from '@cratis/chronicle';
import { defineChronicleCommand } from '../../ChronicleCommand.js';
import { given } from '../../given.js';
import { Account } from '../../given/event_source_routing.js';

describe('when a defined command selects a stream its definition does not declare', given(class {}, () => {
    it('should refuse to be defined', () => {
        (() => defineChronicleCommand({ name: 'Place', schema: z.object({}), eventStore: 'Accounts', client: {} as IChronicleClient,
            eventSource: { source: Account, stream: 'Missing' }, namespaceForContext: () => 'a', produce: () => ({ events: [], response: undefined }) }))
            .should.throw("does not declare");
    });
}));

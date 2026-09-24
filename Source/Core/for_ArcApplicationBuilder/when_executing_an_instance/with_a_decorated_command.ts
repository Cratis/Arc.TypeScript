// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { Severity } from '../../index.js';
import { given } from '../../given.js';
import { RegisterItem } from '../given/RegisterItem.js';
import { ItemName } from '../given/ItemName.js';
import { Items } from '../given/Items.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when executing a decorated command instance directly', given(an_application_builder, context => {
    let result: CommandResult;
    let items: Items;
    beforeEach(async () => {
        items = new Items();
        const builder = context.create();
        builder.services.addSingleton(Items, () => items);
        builder.add(RegisterItem);
        const application = await builder.build();
        try {
            result = await application.server.execute(Object.assign(new RegisterItem(), { name: new ItemName('direct') }), {
                correlationId: randomUUID(), signal: new AbortController().signal, allowedSeverity: Severity.Warning,
                principal: undefined, tenantId: undefined
            });
        } finally { await application.dispose(); }
    });
    it('should produce the encoded response', () => { (result.response as string).should.equal('direct'); });
    it('should invoke the handler', () => { items.values.should.have.lengthOf(1); });
}));

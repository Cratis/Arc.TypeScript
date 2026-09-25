// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { Severity } from '../validation/Severity.js';
import { RegisterItem } from './given/RegisterItem.js';
import { ItemName } from './given/ItemName.js';
import { Items } from './given/Items.js';
import type { CommandResult } from '../commands/CommandResult.js';
import { ArcApplication } from '../ArcApplication.js';

describe('when validating a decorated command instance directly', () => {
    let result: CommandResult;
    let items: Items;
    beforeEach(async () => {
        items = new Items();
        const builder = ArcApplication.createBuilder({ configuration: false });
        builder.services.addSingleton(Items, () => items);
        builder.add(RegisterItem);
        const application = await builder.build();
        try {
            result = await application.server.validate(Object.assign(new RegisterItem(), { name: new ItemName('direct') }), {
                correlationId: randomUUID(), signal: new AbortController().signal, allowedSeverity: Severity.Warning,
                principal: undefined, tenantId: undefined
            });
        } finally { await application.dispose(); }
    });
    it('should return a successful validation result without a response', () => {
        result.isSuccess.should.equal(true);
        (result.response === undefined).should.equal(true);
    });
    it('should not invoke the handler', () => { items.values.should.have.lengthOf(0); });
});

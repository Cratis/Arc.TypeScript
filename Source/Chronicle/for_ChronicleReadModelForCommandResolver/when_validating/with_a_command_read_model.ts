// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { fromEvent } from '@cratis/chronicle/projections';
import { eventType } from '@cratis/chronicle/events';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { ArcApplication, command, CommandValidator, key, readModelForValidation, validator } from '@cratis/arc.core';
import sinon from 'sinon';
import { context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import '../../index.js';

@eventType() class NameSet { @field(String) name = ''; }
@fromEvent(NameSet) class ExistingName { @field(String) id = ''; @field(String) name = ''; }
@command() class SetName {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle() { return this.name; }
}
@validator(SetName) class SetNameValidator extends CommandValidator<SetName> {
    constructor() {
        super();
        this.ruleFor(command => command.name).mustAsync(async name => {
            const existing = await readModelForValidation(ExistingName, { optional: true });
            return existing === null || existing.name !== name;
        }).withMessage('Name is unchanged');
    }
}

describe('when validating with a command read model', () => {
    const find = sinon.stub();
    const getStore = sinon.stub();
    let application: ArcApplication;
    beforeEach(async () => {
        find.reset(); getStore.reset();
        const existing = new ExistingName();
        existing.name = 'Ada';
        find.resolves(existing);
        getStore.callsFake(async (): Promise<IEventStore> => ({ readModels: { findInstanceById: find } }) as unknown as IEventStore);
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Names', client: { getEventStore: getStore } as unknown as IChronicleClient });
        builder.add(SetName, SetNameValidator, ExistingName);
        application = await builder.build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should reject unchanged names in the trusted tenant', async () => {
        const result = await application.server.executeCommand('SetName', { id: 'id-1', name: 'Ada' }, context('tenant-a'));
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('Name is unchanged');
        getStore.calledWith('Names', 'tenant-a').should.equal(true);
        find.calledWith(ExistingName, 'id-1').should.equal(true);
    });
    it('should allow a new name if the read model is missing', async () => {
        find.resolves(null);
        const result = await application.server.executeCommand('SetName', { id: 'id-1', name: 'Grace' }, context());
        result.isSuccess.should.equal(true);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleReadConsistency } from '../../ChronicleReadConsistency.js';
import { passive } from '@cratis/chronicle/projections';
import sinon from 'sinon';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';

class ActiveView { id = ''; }
@passive class PassiveView { id = ''; }

describe('when selecting immediate Chronicle reads', () => {
    const find = sinon.stub().resolves({ id: 'source' });
    const getInstances = sinon.stub().resolves([{ id: 'source' }]);
    const models = new ChronicleReadModels({ getStore: async () => ({ readModels: { findInstanceById: find, getInstances } }) } as never,
        { tenantId: 'Default' } as never);
    it('should refuse to claim immediate consistency for an active projection', async () => {
        await models.findInstanceById(ActiveView, 'source', ChronicleReadConsistency.Immediate).should.be.rejectedWith(
            'Immediate Chronicle reads require a passive model-bound projection');
        find.called.should.equal(false);
    });
    it('should use the kernel on-demand lookup for a passive projection', async () => {
        (await models.findInstanceById(PassiveView, 'source', ChronicleReadConsistency.Immediate))!.id.should.equal('source');
        find.calledWith(PassiveView, 'source').should.equal(true);
    });
    it('should use the kernel on-demand all-instances read for a passive projection', async () => {
        (await models.getAll(PassiveView, ChronicleReadConsistency.Immediate)).should.have.lengthOf(1);
        getInstances.calledWith(PassiveView).should.equal(true);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { SecuredActions } from '../../../SecuredActions.js';
import { AdminQueryGate } from '../../AdminGate.js';
import { CrossCuttingStatus } from '../../Securing.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_secured_status {
    actions = new SecuredActions();
    scenario = QueryScenario.for<{ runs: number }>(CrossCuttingStatus, 'secured');

    constructor() {
        this.scenario.extend(builder => { builder.useGeneratedMetadata(metadata); builder.add(AdminQueryGate); });
        this.scenario.services.addSingleton(SecuredActions, this.actions);
        this.actions.run();
    }
}

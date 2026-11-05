// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { SecuredActions } from '../../../SecuredActions.js';
import { AdminCommandGate } from '../../AdminGate.js';
import { RunSecuredCommand } from '../../Securing.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_secured_command {
    actions = new SecuredActions();
    scenario = CommandScenario.for(RunSecuredCommand);

    constructor() {
        this.scenario.extend(builder => { builder.useGeneratedMetadata(metadata); builder.add(AdminCommandGate); });
        this.scenario.services.addSingleton(SecuredActions, this.actions);
    }

    signInWith(...roles: string[]): this {
        this.scenario.withContext({ principal: { id: 'someone', roles, isAuthenticated: true } });
        return this;
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, query, readModel } from '@cratis/arc.core';
import { SecuredActions } from '../SecuredActions.js';

/** Run a secured action. The AdminGate filter, not this class, decides who may. */
@command()
export class RunSecuredCommand {
    @field(String) reason!: string;

    handle(actions: SecuredActions): void { actions.run(); }
}

/** What the secured actions did so far; secured by the same filter. */
@readModel()
export class CrossCuttingStatus {
    @field(Number) runs!: number;
    @field(String) lastRunAt!: string;

    @query()
    static secured(actions: SecuredActions): CrossCuttingStatus {
        return { runs: actions.runs, lastRunAt: actions.lastRunAt ?? '' };
    }
}

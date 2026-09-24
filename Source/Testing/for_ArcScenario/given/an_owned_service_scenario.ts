// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { defineCommand } from '../../../Arc.Core/commands/defineCommand.js';
import { currentServices } from '../../../Arc.Core/dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../../Arc.Core/dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../../Arc.Core/queries/defineQuery.js';
import { Severity } from '../../../Arc.Core/validation/Severity.js';
import { validation } from '../../../Arc.Core/validation/ValidationResult.js';
import { ArcScenario } from '../../ArcScenario.js';

export class an_owned_service_scenario {
    disposed = false;
    scenario: ArcScenario;

    constructor() {
        const owned = serviceToken<{ close: () => void }>('external');
        const absent = serviceToken<object>('absent');
        this.scenario = new ArcScenario({ services: [{ token: owned, lifetime: 'singleton', instance: {
            close: () => { this.disposed = true; }, [Symbol.dispose]: () => { this.disposed = true; }
        } }], commands: [
            defineCommand({ name: 'Rule', schema: z.object({}), validate: () => [validation('bad', ['name'], 'rule', Severity.Error)], handle: () => 1 }),
            defineCommand({ name: 'Dynamic', schema: z.object({}), validate: async () => { await currentServices().resolve(absent); return []; }, handle: () => 1 })
        ], queries: [defineQuery({ name: 'Value', schema: z.object({}), perform: () => currentServices().resolve(owned).then(value => Boolean(value)) })]
        } as unknown as ConstructorParameters<typeof ArcScenario>[0]);
    }
}

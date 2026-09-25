// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { defineCommand } from '../../../Core/commands/defineCommand.js';
import { currentServices } from '../../../Core/dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../../Core/dependencyInjection/ServiceToken.js';
import { ServiceLifetime } from '../../../Core/dependencyInjection/ServiceLifetime.js';
import { defineQuery } from '../../../Core/queries/defineQuery.js';
import { Severity } from '../../../Core/validation/Severity.js';
import { validation } from '../../../Core/validation/ValidationResult.js';
import { ArcScenario } from '../../ArcScenario.js';

export class an_owned_service_scenario {
    disposed = false;
    scenario: ArcScenario;

    constructor() {
        const owned = serviceToken<{ close: () => void }>('external');
        const absent = serviceToken<object>('absent');
        this.scenario = new ArcScenario({ services: [{ token: owned, lifetime: ServiceLifetime.Singleton, instance: {
            close: () => { this.disposed = true; }, [Symbol.dispose]: () => { this.disposed = true; }
        } }], commands: [
            defineCommand({ name: 'Rule', schema: z.object({}), validate: () => [validation('bad', ['name'], 'rule', Severity.Error)], handle: () => 1 }),
            defineCommand({ name: 'Dynamic', schema: z.object({}), validate: async () => { await currentServices().resolve(absent); return []; }, handle: () => 1 })
        ], queries: [defineQuery({ name: 'Value', schema: z.object({}), perform: () => currentServices().resolve(owned).then(value => Boolean(value)) })]
        } as unknown as ConstructorParameters<typeof ArcScenario>[0]);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServerOptions } from '../ArcServerOptions.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import { CommandContextValues } from './CommandContextValues.js';
import type { CommandContext } from './CommandContext.js';
import { DefaultKeyForCommandResolver } from './DefaultKeyForCommandResolver.js';
/** Capture a single, scoped snapshot of values and the resolved command key. */
export async function createCommandContext(command: unknown, execution: ExecutionContext, options: ArcServerOptions): Promise<CommandContext> {
    const services = currentServices();
    const values = new CommandContextValues();
    for (const token of options.commandContextValuesProviders ?? []) values.merge(await (await services.resolve(token)).provide(command));
    if (!values.has('resolvedKey')) {
        let key: string | undefined;
        for (const token of options.commandKeyProviders ?? []) {
            key = (await services.resolve(token)).resolve(command);
            if (key) break;
        }
        key ??= new DefaultKeyForCommandResolver().resolve(command);
        if (key) values.set('resolvedKey', key);
    }
    const key = values.get('resolvedKey');
    return { ...execution, command, key: typeof key === 'string' && key.length ? key : undefined, values };
}

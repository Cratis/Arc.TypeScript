// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ServiceToken } from '../../dependencyInjection/ServiceToken.js';
import type { CommandContext } from '../CommandContext.js';

const resolvers = new WeakMap<object, (context: CommandContext) => unknown | Promise<unknown>>();
/** Bind an integration-owned handle/provide parameter to the current command context. */
export function commandArgument<T>(name: string, resolve: (context: CommandContext) => T | Promise<T>): ServiceToken<T> {
    const token = serviceToken<T>(name);
    resolvers.set(token, resolve);
    return token;
}
export function contextArgumentResolver(token: object): ((context: CommandContext) => unknown | Promise<unknown>) | undefined {
    return resolvers.get(token);
}

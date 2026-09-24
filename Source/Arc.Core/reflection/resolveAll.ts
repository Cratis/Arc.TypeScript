// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';

/** Resolve ordered service tokens in the current execution scope. */
export async function resolveAll(tokens: readonly ServiceIdentifier<unknown>[]): Promise<unknown[]> {
    return Promise.all(tokens.map(token => currentServices().resolve(token)));
}

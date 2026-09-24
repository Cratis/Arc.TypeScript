// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from './ExecutionContext.js';
export const requestContext = new AsyncLocalStorage<ExecutionContext | undefined>();
/** Singleton factories retain causal ancestry, but no request ambient authority. */
export function withoutRequestContext<T>(callback: () => T): T { return requestContext.run(undefined, callback); }

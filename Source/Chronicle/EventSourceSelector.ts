// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';

/**
 * Names a Chronicle event source definition: the class decorated with `@eventSource`, its registered name, or a thunk
 * returning the class. Use the thunk when the definition's module imports the declaring class (a circular import).
 */
export type EventSourceSelector = Constructor | string | (() => Constructor);

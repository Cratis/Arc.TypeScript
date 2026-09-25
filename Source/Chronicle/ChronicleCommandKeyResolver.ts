// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { chronicleIdentity } from './chronicleIdentity.js';
import type { CommandKeyResolver } from '@cratis/arc.core';
/** Resolve the same event-source identity for read models and returned events. */
export class ChronicleCommandKeyResolver implements CommandKeyResolver {
    resolve(command: unknown): string | undefined {
        const value = (command as { getEventSourceId?: () => unknown } | null)?.getEventSourceId?.();
        return chronicleIdentity(value, 'event source id');
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import type { CommandKeyResolver } from '@cratis/arc.core';
/** Resolve the same event-source identity for read models and returned events. */
export class ChronicleCommandKeyResolver implements CommandKeyResolver {
    resolve(command: unknown): string | undefined {
        const value = (command as { getEventSourceId?: () => unknown } | null)?.getEventSourceId?.();
        if (typeof value === 'string') return value || undefined;
        if (value instanceof ConceptAs && typeof value.value === 'string') return value.value || undefined;
        if (value !== undefined) throw new Error('The command provided an invalid event source id');
        return undefined;
    }
}

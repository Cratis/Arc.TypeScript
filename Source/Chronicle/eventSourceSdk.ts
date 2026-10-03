// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';

interface EventSourceSdk {
    getEventSourceMetadata?(target: Function): { readonly name: string } | undefined;
    getEventStreamsFor?(target: Function): ReadonlyArray<{ readonly name: string }>;
}

// A dynamic import cannot stop this package from linking against an older SDK; the helpers then report the missing support.
const sdk = await import('@cratis/chronicle') as unknown as EventSourceSdk;

/** The name and declared streams of an `@eventSource` class. */
export interface DeclaredEventSource {
    readonly name: string;
    readonly streams: readonly string[];
}

/** Whether the installed Chronicle SDK understands event source definitions. */
export const supportsEventSources = typeof sdk.getEventSourceMetadata === 'function';

/** Read the definition a class declares, or undefined when it is not an `@eventSource` class. */
export function declaredEventSource(type: Constructor): DeclaredEventSource | undefined {
    if (!sdk.getEventSourceMetadata || !sdk.getEventStreamsFor) throw new Error(unsupported(type.name));
    const metadata = sdk.getEventSourceMetadata(type);
    return metadata ? { name: metadata.name, streams: sdk.getEventStreamsFor(type).map(stream => stream.name) } : undefined;
}

/** The message for a feature that needs a newer Chronicle SDK. */
export function unsupported(subject: string): string {
    return `${subject} uses a Chronicle event source definition, which requires @cratis/chronicle 6.49.0 or later`;
}

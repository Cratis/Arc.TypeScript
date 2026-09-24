// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Case-insensitive per-command values; later providers replace earlier keys. */
export class CommandContextValues extends Map<string, unknown> {
    override set(key: string, value: unknown): this { return super.set(key.toLowerCase(), value); }
    override get(key: string): unknown { return super.get(key.toLowerCase()); }
    override has(key: string): boolean { return super.has(key.toLowerCase()); }
    override delete(key: string): boolean { return super.delete(key.toLowerCase()); }
    /** Merge values without discarding an explicitly empty resolved key. */
    merge(values: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>): void {
        for (const [key, value] of values instanceof Map ? values : Object.entries(values)) this.set(key, value);
    }
}

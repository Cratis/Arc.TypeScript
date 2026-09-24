// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Case-insensitive per-command values; later providers replace earlier keys. */
export class CommandContextValues extends Map<string, unknown> {
    readonly #originalKeys = new Map<string, string>();
    override set(key: string, value: unknown): this {
        const normalized = key.toLowerCase();
        const original = this.#originalKeys.get(normalized) ?? key;
        this.#originalKeys.set(normalized, original);
        return super.set(original, value);
    }
    override get(key: string): unknown { return super.get(this.#originalKeys.get(key.toLowerCase()) ?? key); }
    override has(key: string): boolean { return this.#originalKeys.has(key.toLowerCase()); }
    override delete(key: string): boolean {
        const normalized = key.toLowerCase();
        const original = this.#originalKeys.get(normalized);
        this.#originalKeys.delete(normalized);
        return original !== undefined && super.delete(original);
    }
    override clear(): void { this.#originalKeys.clear(); super.clear(); }
    /** Merge values without discarding an explicitly empty resolved key. */
    merge(values: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>): void {
        for (const [key, value] of values instanceof Map ? values : Object.entries(values)) this.set(key, value);
    }
}

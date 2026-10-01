// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Keep at most 1,000 distinct metric names, folding further names into .NET's overflow value. */
export class CardinalityLimiter {
    readonly #names = new Set<string>();
    limit(name: string): string {
        if (this.#names.has(name)) return name;
        if (this.#names.size >= 1000) return '_other';
        this.#names.add(name);
        return name;
    }
}

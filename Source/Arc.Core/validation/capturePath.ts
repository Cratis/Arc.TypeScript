// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Capture a direct member selector without evaluating a real model. */
export function capturePath<T>(selector: (model: T) => unknown): readonly string[] {
    if (/\?\.|\[/.test(selector.toString())) throw new Error('Validation selectors require direct property access');
    const accessed: string[][] = [];
    const paths = new WeakMap<object, readonly string[]>();
    const proxy = (path: string[]): object => {
        const object = new Proxy(() => {}, {
        get(_target, key) {
            if (typeof key !== 'string' || key === 'then' || key === 'valueOf' || key === 'toString') throw new Error('Invalid validation selector');
            if (/^(?:0|[1-9]\d*)$/.test(key)) throw new Error('Validation selectors cannot index arrays');
            const next = [...path, key];
            accessed.push(next);
            return proxy(next);
        },
        apply() { throw new Error('Validation selectors cannot call methods'); }
        });
        paths.set(object, path);
        return object;
    };
    const result = selector(proxy([]) as T);
    const selected = result && typeof result === 'function' ? paths.get(result) : undefined;
    if (!selected?.length || accessed.some(path => !path.every((part, index) => selected[index] === part)))
        throw new Error('Validation selector must return one property');
    return selected;
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Instances received through Chronicle's releasing read paths, not raw storage. */
const kernelReleasedReadModels = new WeakSet<object>();

/**
 * Mark a read model returned by a Chronicle kernel read, and every object reachable from it: the kernel releases
 * the whole graph, including nested child instances rebuilt during deserialization.
 */
export function markKernelReleased<T>(model: T): T {
    const pending: unknown[] = [model];
    while (pending.length) {
        const value = pending.pop();
        if (value === null || typeof value !== 'object' || kernelReleasedReadModels.has(value) ||
            ArrayBuffer.isView(value)) continue;
        kernelReleasedReadModels.add(value);
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) pending.push(value[index]);
        } else {
            for (const key in value) if (Object.hasOwn(value, key)) pending.push((value as Record<string, unknown>)[key]);
        }
    }
    return model;
}

/** Check whether this exact instance has already been released by Chronicle. */
export function isKernelReleased(model: object): boolean {
    return kernelReleasedReadModels.has(model);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Instances received through Chronicle's releasing read paths, not raw storage. */
const kernelReleasedReadModels = new WeakSet<object>();

/** Mark a read model returned by a Chronicle kernel read. */
export function markKernelReleased<T>(model: T): T {
    if (model !== null && typeof model === 'object') kernelReleasedReadModels.add(model);
    return model;
}

/** Check whether this exact instance has already been released by Chronicle. */
export function isKernelReleased(model: object): boolean {
    return kernelReleasedReadModels.has(model);
}

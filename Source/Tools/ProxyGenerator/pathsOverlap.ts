// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sep } from 'node:path';

/** Whether either directory contains the other (including equality). */
export function pathsOverlap(first: string, second: string): boolean {
    const inside = (parent: string, child: string) => child === parent || child.startsWith(parent + sep);
    return inside(first, second) || inside(second, first);
}

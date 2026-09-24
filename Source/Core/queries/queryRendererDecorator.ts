// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../reflection/metadataFor.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Discover a scoped query renderer through builder.add() or discover(). */
export function queryRenderer(): DualClassDecorator {
    return target => { metadataFor(target).queryRenderer = true; };
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../reflection/metadataFor.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Discover a command authorization filter through builder.add() or discover(). */
export function authorizationCommandFilter(): DualClassDecorator {
    return target => { metadataFor(target).authorizationCommandFilter = true; };
}

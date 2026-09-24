// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../reflection/metadataFor.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
/** Mark a class for builder.add() or folder discovery as a scoped response handler. */
export function commandResponseValueHandler(): DualClassDecorator {
    return target => { metadataFor(target).responseValueHandler = true; };
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../../reflection/metadataFor.js';
import type { DualClassDecorator } from '../../reflection/DualClassDecorator.js';

/** Mark a class as a read model with static query methods. */
export function readModel(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.readModel = true; data.namespace = options.namespace; };
}

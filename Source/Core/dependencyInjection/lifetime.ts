// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from './ServiceLifetime.js';
import { metadataFor } from '../reflection/metadataFor.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Set the lifetime of a discovered service. */
export function lifetime(value: ServiceLifetime): DualClassDecorator {
    return target => { metadataFor(target).lifetime = value; };
}

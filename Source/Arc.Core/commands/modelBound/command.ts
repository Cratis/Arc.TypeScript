// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../../reflection/metadataFor.js';
import type { DualClassDecorator } from '../../reflection/DualClassDecorator.js';

/** Mark a class as a command with an optional stable namespace. */
export function command(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.command = true; data.namespace = options.namespace; };
}

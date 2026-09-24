// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../reflection/metadataFor.js';
import type { ServiceIdentifier } from './ServiceIdentifier.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Declare class constructor dependencies for service registration. */
export function injectable(...tokens: readonly ServiceIdentifier<unknown>[]): DualClassDecorator {
    return target => { metadataFor(target).constructorTokens = tokens; };
}

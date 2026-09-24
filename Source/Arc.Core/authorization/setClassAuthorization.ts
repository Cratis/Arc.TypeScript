// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import { combineAuthorization } from './combineAuthorization.js';
import { metadataFor } from '../reflection/metadataFor.js';
import type { ClassType } from '../reflection/ClassType.js';

/** Add an independent authorization requirement for this class. */
export function setClassAuthorization(target: ClassType, authorization: Authorization): void {
    const metadata = metadataFor(target);
    metadata.authorization = combineAuthorization(metadata.authorization, authorization);
}

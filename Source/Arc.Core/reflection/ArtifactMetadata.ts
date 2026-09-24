// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from '../authorization/Authorization.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { QueryMetadata } from '../queries/modelBound/QueryMetadata.js';
import type { ClassType } from './ClassType.js';
import type { FieldOptions } from './FieldOptions.js';
/** Shared decorator metadata stored by declaration, including individual member names. */
export interface ArtifactMetadata {
    command?: boolean;
    readModel?: boolean;
    namespace?: string;
    authorization?: Authorization;
    path?: string;
    injected?: Map<string, readonly ServiceIdentifier<unknown>[]>;
    queryMethods?: Map<string, QueryMetadata>;
    methodAuthorization?: Map<string, Authorization>;
    methodRoutes?: Map<string, string>;
    fieldOptions?: Map<string, FieldOptions>;
    lifetime?: 'singleton' | 'scoped' | 'transient';
    constructorTokens?: readonly ServiceIdentifier<unknown>[];
    validatorTarget?: ClassType;
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../dependencyInjection/ServiceLifetime.js';
import type { Authorization } from '../authorization/Authorization.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { QueryMetadata } from '../queries/modelBound/QueryMetadata.js';
import type { ClassType } from './ClassType.js';
import type { FieldOptions } from './FieldOptions.js';
import type { GeneratedReturn } from './GeneratedReturn.js';
/** Shared decorator metadata stored by declaration, including individual member names. */
export interface ArtifactMetadata {
    command?: boolean;
    handleResult?: GeneratedReturn;
    /** Declared handle value before response handlers consume it; used for return validation. */
    handleValueResult?: GeneratedReturn;
    responseValueHandler?: boolean;
    authorizationCommandFilter?: boolean;
    commandPipelineFilter?: boolean;
    queryRenderer?: boolean;
    readModelInterceptor?: boolean;
    readModel?: boolean;
    namespace?: string;
    summary?: string;
    methodSummaries?: Map<string, string>;
    authorization?: Authorization;
    path?: string;
    injected?: Map<string, readonly ServiceIdentifier<unknown>[]>;
    generatedBindings?: boolean;
    handleParameters?: number;
    provideParameters?: number;
    queryMethods?: Map<string, QueryMetadata>;
    methodAuthorization?: Map<string, Authorization>;
    methodRoutes?: Map<string, string>;
    fieldOptions?: Map<string, FieldOptions>;
    keyField?: string;
    lifetime?: ServiceLifetime;
    constructorTokens?: readonly ServiceIdentifier<unknown>[];
    validatorTarget?: ClassType;
}

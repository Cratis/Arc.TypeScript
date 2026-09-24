// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceField } from './SourceField.js';
import type { SourceType } from './SourceType.js';
import type { QueryHttpMethod } from '@cratis/arc.core';
export interface SourceOperation {
    readonly kind: 'command' | 'query' | 'observable';
    readonly name: string;
    readonly namespace: string;
    readonly owner: string;
    readonly routeOverride?: string;
    readonly treatWarningsAsErrors?: boolean;
    readonly httpMethod?: QueryHttpMethod;
    readonly roles: readonly string[];
    readonly fields: readonly SourceField[];
    readonly result: SourceType;
}

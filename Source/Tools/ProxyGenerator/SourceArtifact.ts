// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export interface SourceType {
    readonly text: string;
    readonly constructor: string;
    readonly model?: string;
    readonly package?: string;
    readonly enumerable: boolean;
    readonly nullable: boolean;
    readonly void: boolean;
}
export interface SourceField { readonly name: string; readonly type: SourceType; readonly optional: boolean }
export interface SourceModel {
    readonly kind: 'model' | 'enum';
    readonly name: string;
    readonly namespace: string;
    readonly fields: readonly SourceField[];
    readonly members?: readonly { name: string; value: string | number }[];
}
export interface SourceOperation {
    readonly kind: 'command' | 'query' | 'observable';
    readonly name: string;
    readonly namespace: string;
    readonly owner: string;
    readonly routeOverride?: string;
    readonly roles: readonly string[];
    readonly fields: readonly SourceField[];
    readonly result: SourceType;
}
export interface SourceAnalysis {
    readonly operations: readonly SourceOperation[];
    readonly models: readonly SourceModel[];
}

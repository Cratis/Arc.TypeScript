// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceField } from './SourceField.js';
export interface SourceModel {
    readonly kind: 'model' | 'enum';
    readonly name: string;
    readonly namespace: string;
    readonly fields: readonly SourceField[];
    readonly members?: readonly { name: string; value: string | number }[];
}

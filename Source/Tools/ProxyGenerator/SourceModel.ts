// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceField } from './SourceField.js';
export interface SourceModel {
    readonly kind: 'model' | 'enum';
    readonly name: string;
    readonly namespace: string;
    readonly fields: readonly SourceField[];
    readonly members?: readonly { name: string; value: string | number }[];
    readonly base?: string;
    readonly baseKey?: string;
    /** Package a mapped base class is imported from; the base is not generated. */
    readonly basePackage?: string;
    readonly derivedTypeId?: string;
    /**
     * Set for the empty class of an indirect or generic concept subclass, which nothing generated references.
     * `value` is the underlying client type when every instantiation shares one and it is safe to quote.
     */
    readonly deprecated?: { readonly value?: string };
}

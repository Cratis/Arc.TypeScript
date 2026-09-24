// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Field annotations participating in wire validation and serialization. */
export interface FieldOptions {
    optional?: boolean;
    nullable?: boolean;
    defaultValue?: unknown;
    values?: readonly (string | number | boolean)[];
    key?: boolean;
    /** Accept named nonfinite JSON literals on input for this numeric field. */
    namedFloats?: boolean;
}

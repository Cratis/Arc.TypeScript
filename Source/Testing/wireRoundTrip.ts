// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { encodeWireValue } from '@cratis/arc.core';

/** Cross the JSON wire boundary before passing data to the real pipeline. */
export function wireRoundTrip(value: unknown): unknown {
    return JSON.parse(JSON.stringify(encodeWireValue(value))) as unknown;
}

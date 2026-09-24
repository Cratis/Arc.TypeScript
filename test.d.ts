// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Assertion } from 'chai';

declare global {
    interface Object {
        should: Assertion;
    }
}

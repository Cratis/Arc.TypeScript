// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
export class Alpha {}
export class Beta {}
@command()
export class MixedServices {
    handle(service: Alpha | Beta): void { void service; }
}

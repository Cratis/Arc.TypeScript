// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import type { ArcOptions } from '../../ArcOptions.js';

/** Undecorated builder context for an independent model-bound behavior. */
export class an_application_builder {
    readonly builder = ArcApplication.createBuilder({ development: true });
    create(options: ArcOptions = {}) { return ArcApplication.createBuilder({ development: true, ...options }); }
}

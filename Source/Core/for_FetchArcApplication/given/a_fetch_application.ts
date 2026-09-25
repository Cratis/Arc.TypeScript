// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { FetchArcApplication } from '../../FetchArcApplication.js';
import type { ArcApplicationBuilder } from '../../ArcApplicationBuilder.js';
import { Submit } from './Submit.js';
import { Inventory } from './Inventory.js';

/** An application assembled without discovery or filesystem configuration. */
export class a_fetch_application {
    builder(): ArcApplicationBuilder {
        const builder = FetchArcApplication.createBuilder();
        builder.add(Submit, Inventory);
        return builder;
    }
    async create(): Promise<FetchArcApplication> { return this.builder().build(); }
}

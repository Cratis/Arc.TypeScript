// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { Echo } from './Echo.js';
import { Item } from './Item.js';

/** An application builder with two distinct artifacts registered in order. */
export class a_builder_with_registered_artifacts {
    readonly builder = ArcApplication.createBuilder();
    constructor() { this.builder.add(Echo, Item, Echo); }
}

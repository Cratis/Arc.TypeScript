// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { ShowcaseCatalog } from '../../../ShowcaseCatalog.js';
import { ShowcaseItem } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

type Items = { id: number; name: string; category: string }[];

export class a_showcase_catalog {
    all = QueryScenario.for<Items>(ShowcaseItem, 'all');
    latest = QueryScenario.for<Items>(ShowcaseItem, 'latest');

    constructor() {
        for (const scenario of [this.all, this.latest]) {
            scenario.extend(builder => builder.useGeneratedMetadata(metadata));
            scenario.services.addSingleton(ShowcaseCatalog, new ShowcaseCatalog(12));
        }
    }
}

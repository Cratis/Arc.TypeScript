// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { ShowcaseCatalog } from '../../../ShowcaseCatalog.js';
import { ShowcaseItemDetail } from '../../Lookup.js';
import { metadata } from '../../../../generatedMetadata.js';

type Detail = { id: number; name: string; category: string };

export class a_catalog_lookup {
    byId = QueryScenario.for<Detail | undefined>(ShowcaseItemDetail, 'byId');
    byCategory = QueryScenario.for<Detail[]>(ShowcaseItemDetail, 'byCategory');

    constructor() {
        for (const scenario of [this.byId, this.byCategory]) {
            scenario.extend(builder => builder.useGeneratedMetadata(metadata));
            scenario.services.addSingleton(ShowcaseCatalog, new ShowcaseCatalog(12));
        }
    }
}

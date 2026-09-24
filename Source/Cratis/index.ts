// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '@cratis/arc.core';
import type { ArcBuilderOptions, ArcApplicationBuilder } from '@cratis/arc.core';
import { withChronicle } from '@cratis/arc.chronicle';
import type { ChronicleRegistration } from '@cratis/arc.chronicle';

export * from '@cratis/arc.core';
export * from '@cratis/arc.chronicle';

/** Compose Arc and a tenant-scoped Chronicle client without selecting an authentication handler. */
export function addCratis(builder: ArcApplicationBuilder, chronicle: Partial<ChronicleRegistration> = {}): ArcApplicationBuilder {
    return withChronicle(builder, chronicle);
}

/** Node setup analog of AddCratis; Chronicle connection settings can come from appsettings.json. */
export class CratisApplication {
    static createBuilder(options: ArcBuilderOptions = {}, chronicle: Partial<ChronicleRegistration> = {}): ArcApplicationBuilder {
        return addCratis(ArcApplication.createBuilder(options), chronicle);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, ArcApplicationBuilder } from '@cratis/arc.core';
import type { ArcBuilderOptions } from '@cratis/arc.core';
import { ArcApplicationBuilder as FetchArcApplicationBuilder } from '@cratis/arc.core/fetch';
import '@cratis/arc.chronicle';
import type { ChronicleRegistration } from '@cratis/arc.chronicle';

export * from '@cratis/arc.core';
export * from '@cratis/arc.chronicle';

declare module '@cratis/arc.core/fetch' {
    interface ArcBuilderExtensions {
        /** Attach Chronicle as part of the Cratis composition. */
        addCratis(options?: Partial<ChronicleRegistration>): this;
    }
}

ArcApplicationBuilder.prototype.addCratis = function (options: Partial<ChronicleRegistration> = {}) {
    return this.extend('chronicle', options);
};
FetchArcApplicationBuilder.prototype.addCratis = function (options: Partial<ChronicleRegistration> = {}) {
    return this.extend('chronicle', options);
};
/** Node setup analog of AddCratis; Chronicle connection settings can come from appsettings.json. */
export class CratisApplication {
    static createBuilder(options: ArcBuilderOptions = {}, chronicle: Partial<ChronicleRegistration> = {}): ArcApplicationBuilder {
        return ArcApplication.createBuilder(options).addCratis(chronicle);
    }
}

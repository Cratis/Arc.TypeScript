// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Integration packages augment this interface; core never imports optional dependencies. */
export interface ArcBuilderIntegrationOptions {
    /** Reserved: declarations in optional packages add the callable integration options. */
    readonly __arcExtensionTypes?: never;
}

/** A builder method becomes callable only when its integration's types are imported. */
export type IntegrationOptions<Name extends string> = Name extends keyof ArcBuilderIntegrationOptions ? ArcBuilderIntegrationOptions[Name] : never;

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { identityDetailsProvider } from '@cratis/arc.core';
import { ExternalDetails } from '../ExternalDetails.js';
@identityDetailsProvider()
export class ExternalProvider {
    readonly detailsType = ExternalDetails;
    provide(): ExternalDetails { return new ExternalDetails(); }
}

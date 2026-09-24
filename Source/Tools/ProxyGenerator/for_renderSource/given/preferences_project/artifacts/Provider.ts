// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { identityDetailsProvider } from '@cratis/arc.core';
import { Details } from './Details.js';

@identityDetailsProvider()
export class Provider {
    readonly detailsType = Details;
    provide(): Details { return new Details(); }
}

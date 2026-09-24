// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { BaseNotice } from './BaseNotice.js';

/** Registered subtype loaded into both the server and generated client. */
@derivedType('urgent')
export class UrgentNotice extends BaseNotice {
    @field(Number) priority!: number;
}

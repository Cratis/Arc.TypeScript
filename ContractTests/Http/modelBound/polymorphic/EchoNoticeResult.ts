// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { BaseNotice } from './BaseNotice.js';

/** Declared response with a polymorphic field decoded by the published client. */
export class EchoNoticeResult {
    @field(BaseNotice) notice!: BaseNotice;
}

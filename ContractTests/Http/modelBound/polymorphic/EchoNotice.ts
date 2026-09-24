// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { BaseNotice } from './BaseNotice.js';
import { EchoNoticeResult } from './EchoNoticeResult.js';
import './UrgentNotice.js';

/** Echo a polymorphic input to test the published client on a real host. */
@command({ namespace: 'Fixtures' })
export class EchoNotice {
    @field(BaseNotice) notice!: BaseNotice;
    handle(): EchoNoticeResult {
        const result = new EchoNoticeResult();
        result.notice = this.notice;
        return result;
    }
}

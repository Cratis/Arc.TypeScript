// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TemporalMessage } from './TemporalMessage.js';
/** Input prepared before a temporal wire round trip. */
export class a_temporal_message {
    readonly type = TemporalMessage;
    readonly fields = { occurred: '2026-09-24T12:30:00.000Z', date: '2026-09-24',
        time: '12:30:00', duration: '01:02:03' };
}

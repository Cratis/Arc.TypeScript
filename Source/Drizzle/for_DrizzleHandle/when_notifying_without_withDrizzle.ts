// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleHandle } from '../DrizzleHandle.js';
import { TaskRecord } from '../for_DrizzleReadModels/given/TaskRecord.js';

describe('when notifying from a directly constructed Drizzle handle', () => {
    let notify: () => void;
    beforeEach(() => { notify = () => new DrizzleHandle({}).notifyChanged(TaskRecord); });
    it('should require withDrizzle instead of silently ignoring the change', () => {
        notify.should.throw('Drizzle change notification requires withDrizzle');
    });
});

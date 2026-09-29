// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { ChronicleRegistration } from '../ChronicleOptions.js';
import { withChronicle } from '../withChronicle.js';

should();
describe('when code supplies a Chronicle client and a read model naming policy', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        try {
            withChronicle(new ArcApplicationBuilder(), {
                client: {} as ChronicleRegistration['client'], eventStore: 'Tasks',
                readModelNamingPolicy: (identifier: string) => identifier
            } as unknown as Partial<ChronicleRegistration>);
        } catch (error) { failure = error as Error; }
    });
    it('should reject it because Arc does not change a caller-owned client', () => {
        failure!.message.should.contain('applies only to an Arc-owned client');
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { clonePrincipal } from '../../clonePrincipal.js';

should();

describe('when cloning a principal with noncloneable extra fields', () => {
    let copy: ReturnType<typeof clonePrincipal>;
    const original = { id: 'alice', isAuthenticated: true, roles: ['reader'],
        claims: { team: 'blue' }, can: () => true };

    beforeEach(() => { copy = clonePrincipal(original); });

    it('should retain the verified identity and claims without copying extra fields', () => {
        should().equal(copy?.id, 'alice');
        should().equal((copy?.claims as { team: string }).team, 'blue');
        should().equal(Object.hasOwn(copy ?? {}, 'can'), false);
    });

    it('should isolate and freeze the copied claims', () => {
        should().equal(copy?.claims === original.claims, false);
        should().equal(Object.isFrozen(copy?.claims), true);
    });
});

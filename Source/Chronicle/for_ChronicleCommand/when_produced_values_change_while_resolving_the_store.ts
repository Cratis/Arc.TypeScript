// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import type { CommandResult } from '@cratis/arc.core';
import { given } from '../given.js';
import { a_command_with_mutable_produced_values } from './given/a_command_with_mutable_produced_values.js';

should();

describe('when produced values change while resolving the event store', given(a_command_with_mutable_produced_values, context => {
    let result: CommandResult<unknown>;

    beforeEach(async () => {
        context.reset();
        result = await context.server.executeCommand('Place', {}, context.context);
    });
    afterEach(async () => context.server.dispose());

    it('should succeed with the preflighted event', () => result.isSuccess.should.equal(true));
    it('should retain the preflighted response', () => result.should.have.property('response', 'done'));
    it('should append exactly once', () => context.append.callCount.should.equal(1));
    it('should retain the original event source', () => context.append.firstCall.args[0].should.equal('original'));
    it('should retain the original subject', () => context.append.firstCall.args[2].should.have.property('subject', 'original-subject'));
    it('should retain the original occurrence time', () => context.append.firstCall.args[2].occurred.toISOString().should.equal('2026-01-01T00:00:00.000Z'));
    it('should retain the original tags', () => context.append.firstCall.args[2].tags.should.deep.equal(['original-tag']));
}));

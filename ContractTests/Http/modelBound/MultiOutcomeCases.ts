// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command, denied, rejected, response, tuple, validation } from '@cratis/arc.core';
import type { Outcome } from '@cratis/arc.core';

class OutcomeReply { @field(String) value!: string; constructor(value: string) { this.value = value; } }
class OutcomeError { @field(String) code!: string; constructor(code: string) { this.code = code; } }

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class OutcomeDto {
    @field(Boolean) fail!: boolean;
    handle(): Outcome<OutcomeReply> { return this.fail ? rejected(validation('Outcome rejected', ['fail'])) : response(new OutcomeReply('created')); }
}

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class OutcomePrimitive {
    @field(Boolean) fail!: boolean;
    handle(): Outcome<number> { return this.fail ? denied('Outcome denied') : response(42); }
}

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
class OutcomeErrorCase {
    @field(Boolean) fail!: boolean;
    handle(): Outcome<OutcomeReply | OutcomeError> {
        return this.fail ? response(new OutcomeError('already-exists')) : response(new OutcomeReply('created'));
    }
}

// This runtime-only fixture has two incompatible client DTO constructors. The generator must reject it,
// so do not export the class as a discoverable proxy artifact.
export const incompatibleOutcomeCommand = () => OutcomeErrorCase;

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class OutcomeTuple {
    @field(Boolean) fail!: boolean;
    handle() { return this.fail ? tuple(new OutcomeReply('ignored'), rejected(validation('Tuple rejected', ['fail']))) :
        response(new OutcomeReply('created')); }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, inject } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

const uncheckedInject = inject() as (method: object, context: ClassMethodDecoratorContext) => void;

@command()
class MisplacedInjection {
    @uncheckedInject
    unrelated(): string { return 'unused'; }
    provide(): string { return 'prepared'; }
    handle(prepared: string): void { if (!prepared) throw new Error('Missing preparation'); }
}

describe('when building with injection on an unrelated method', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(MisplacedInjection);
        try { const application = await builder.build(); await application.dispose(); }
        catch (failure) { error = failure; }
    });
    it('should reject injection that would otherwise be applied to handle', () => {
        (error as Error).message.should.contain('@inject on MisplacedInjection.unrelated');
    });
}));

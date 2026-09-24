// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ArcApplication, canonicalMetadataSignature, command, CommandValidator } from '../../index.js';

@command()
class ValidatedTask {
    @field(String) title!: string;
    handle(): void {}
}
class GeneratedValidator extends CommandValidator<ValidatedTask> {
    constructor() {
        super();
        this.ruleFor(task => (task as ValidatedTask & { missing: string }).missing).notEmpty();
    }
}

describe('when constructing a validator with an inferred target and an invalid path', () => {
    let error: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: ValidatedTask,
            signature: canonicalMetadataSignature('ValidatedTask', [['title', 'String']], 0, null, []),
            metadata: { command: true } }, { type: GeneratedValidator,
            signature: canonicalMetadataSignature('GeneratedValidator', [], null, null, []),
            metadata: { validatorTarget: ValidatedTask } }] });
        builder.add(ValidatedTask, GeneratedValidator);
        try { await builder.build(); }
        catch (failure) { error = failure; }
    });
    it('should reject the invalid member during validator construction', () => {
        String((error as Error).cause).should.contain('Invalid validation member: missing');
    });
});

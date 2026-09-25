// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { unexportedArtifact } from '../../rules/unexportedArtifact.js';
import { validatorTarget } from '../../rules/validatorTarget.js';
import { missingField } from '../../rules/missingField.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: { ecmaVersion: 2022 } } });
const slice = `import { command, readModel, query, validator, CommandValidator } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
@command() export class RegisterAuthor { @field(String) name!: string; handle() { return this.name; } }
@validator(RegisterAuthor) export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {}
@readModel() export class Author { @field(String) name!: string; @query() static all() { return []; } }`;

tester.run('colocated unexported artifacts', unexportedArtifact, { valid: [slice], invalid: [] });
tester.run('colocated validator target', validatorTarget, { valid: [slice], invalid: [] });
tester.run('colocated fields', missingField, { valid: [slice], invalid: [] });

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, imported } from './syntax.js';

/** Validators without targets are never registered by Arc. */
export const validatorTarget = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Specify @validator(Target) on validators' }, messages: { missing: 'Validator {{name}} needs @validator(Target) to be registered.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            const base = node.superClass;
            if (base && ['CommandValidator', 'QueryValidator', 'ConceptValidator', 'ModelValidator'].some(name => imported(context, base, '@cratis/arc.core', name)) && !decorated(context, node, 'validator')) {
                context.report({ node: node.id ?? node, messageId: 'missing', data: { name: node.id?.name ?? '<anonymous>' } });
            }
        } };
    }
});

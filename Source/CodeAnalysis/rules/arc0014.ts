// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated } from './syntax.js';

/** Generic query methods cannot be bound to HTTP arguments. */
export const arc0014 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Queries cannot have type parameters' }, messages: { generic: 'Query {{name}} cannot be generic; HTTP requests cannot supply type arguments.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            if (decorated(context, node, 'query') && node.value.typeParameters?.params.length) context.report({ node: node.key, messageId: 'generic', data: { name: context.sourceCode.getText(node.key) } });
        } };
    }
});

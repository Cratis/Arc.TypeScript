// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { TSESLint } from '@typescript-eslint/utils';
import { arc0002 } from './rules/arc0002.js';
import { arc0004 } from './rules/arc0004.js';
import { arc0005 } from './rules/arc0005.js';
import { arc0010 } from './rules/arc0010.js';
import { arc0012 } from './rules/arc0012.js';
import { arc0013 } from './rules/arc0013.js';
import { arc0014 } from './rules/arc0014.js';
import { arc0015 } from './rules/arc0015.js';
import { arc0019 } from './rules/arc0019.js';
import { missingField } from './rules/missingField.js';
import { declaredField } from './rules/declaredField.js';
import { injectBinding } from './rules/injectBinding.js';
import { queryBinding } from './rules/queryBinding.js';
import { misplacedDecorator } from './rules/misplacedDecorator.js';
import { unexportedArtifact } from './rules/unexportedArtifact.js';
import { validatorTarget } from './rules/validatorTarget.js';

/** Arc server diagnostics, including .NET ARC identifiers where semantics overlap. */
const rules = {
    arc0002, arc0004, arc0005, arc0010, arc0012, arc0013, arc0014, arc0015, arc0019,
    'missing-field': missingField,
    'declared-field': declaredField,
    'inject-binding': injectBinding,
    'query-binding': queryBinding,
    'misplaced-decorator': misplacedDecorator,
    'unexported-artifact': unexportedArtifact,
    'validator-target': validatorTarget
};

/** ESLint 10 flat-config plugin for Arc server code. */
const plugin: TSESLint.FlatConfig.Plugin = { meta: { name: '@cratis/eslint-plugin-arc-core', version: '0.8.0' }, rules, configs: {} };
const recommended: TSESLint.FlatConfig.Config = {
    name: 'arc-core/recommended',
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'arc-core': plugin },
    rules: Object.fromEntries(Object.keys(rules).map(name => [`arc-core/${name}`, 'error']))
};
plugin.configs = { recommended };
export { rules, recommended };
export default plugin;

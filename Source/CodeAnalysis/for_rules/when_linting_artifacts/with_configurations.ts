// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { TSESLint } from '@typescript-eslint/utils';
import plugin from '../../index.js';

const recommended: TSESLint.FlatConfig.Config = plugin.configs.recommended;
const typeChecked: TSESLint.FlatConfig.Config = plugin.configs['recommended-type-checked'];

describe('when configuring the Arc rules', () => {
    it('should leave the wire name convention opt-in', () => {
        (recommended.rules?.['arc-core/query-argument-name'] === undefined).should.equal(true);
    });

    it('should enable type information in the type-checked preset', () => {
        (typeChecked.languageOptions?.parserOptions?.projectService === true).should.equal(true);
    });
});

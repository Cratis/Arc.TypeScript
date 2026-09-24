// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import arc from '@cratis/eslint-plugin-arc-core';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['**/dist/**', '**/node_modules/**'] },
    ...tseslint.configs.recommended,
    { files: ['Samples/Tasks/Features/**/*.ts'], languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    } },
    arc.configs.recommended
);

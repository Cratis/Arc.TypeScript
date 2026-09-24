// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['**/dist/**', '**/*.tsbuildinfo', '**/node_modules/**'] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    { files: ['**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'error' } }
);

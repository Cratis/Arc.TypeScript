// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderSource } from '../../renderSource.js';

// Captured from Arc.Kotlin/GradlePlugin/src/test/resources/differential/captured/Arc/Kotlin/Differential/Fixture/OrderKind.ts.
// Its metadata header predates .NET's timestamp; the body is compared byte-for-byte.
const capturedBody = `/*---------------------------------------------------------------------------------------------
 *  **DO NOT EDIT** - This file is an automatically generated file.
 *--------------------------------------------------------------------------------------------*/

// eslint-disable-next-line header/header
export enum OrderKind {
    standard = 0,
    express = 1,
}
`;

describe('when rendering a numeric enum against captured .NET output', () => {
    it('should preserve the entire template body byte for byte', () => {
        const rendered = renderSource({ operations: [], models: [{
            kind: 'enum', name: 'OrderKind', namespace: 'Arc.Kotlin.Differential.Fixture', fields: [],
            members: [{ name: 'standard', value: 0 }, { name: 'express', value: 1 }]
        }] });
        rendered.get('Arc/Kotlin/Differential/Fixture/OrderKind.ts')!.should.equal(capturedBody);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
describe('when the bootstrap is imported by a separate entry point', () => {
    let result: string;
    beforeEach(async () => {
        const imported = await import('../given/importedBootstrap/Bootstrap.js' as string);
        result = imported.outcome as string;
    });
    it('should refuse to re-import the suspended bootstrap', () => {
        result.should.contain('bootstrap folder');
    });
});

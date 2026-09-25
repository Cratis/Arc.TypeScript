// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { MongoDBOptions } from '../MongoDBOptions.js';
import { withMongoDB } from '../addMongoDB.js';

should();
describe('when code supplies a MongoDB client over a configured server', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const builder = new ArcApplicationBuilder({}, { Cratis: { MongoDB: { server: 'mongodb://localhost', database: 'Tasks' } } });
        try { withMongoDB(builder, { client: {} as MongoDBOptions['client'], readModels: [] }); }
        catch (error) { failure = error as Error; }
    });
    it('should choose the code client without a conflicting-server error', () => { (failure === undefined).should.equal(true); });
});

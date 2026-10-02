// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { ArcServer } from '../../ArcServer.js';

for (const asynchronous of [false, true]) describe(`when a discovery warning logger fails ${asynchronous ? 'asynchronously' : 'synchronously'}`, () => {
    let warning: sinon.SinonStub;
    beforeEach(async () => {
        warning = sinon.stub(console, 'warn');
        const server = new ArcServer({ environmentName: 'Production', logger: () => {
            if (asynchronous) return Promise.reject(new Error('Logger unavailable'));
            throw new Error('Logger unavailable');
        } });
        await server.dispose();
    });
    afterEach(() => warning.restore());
    it('should report the warning through the console instead of losing it', () => warning.calledOnce.should.be.true);
});

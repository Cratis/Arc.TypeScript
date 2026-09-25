// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '../ArcApplication.js';

should();
describe('when overriding a configured generated API field in code', () => {
    let app: ArcApplication;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ configuration: {
            file: new URL('../configuration/for_loadConfiguration/given/appsettings.json', import.meta.url), env: {}
        }, generatedApis: { routePrefix: 'code' }, hosting: { maxBodyBytes: 512 },
        query: { maxObservableSubscriptionsPerCaller: 3 }, exposeExceptionDetails: false });
        app = await builder.build();
    });
    afterEach(async () => { await app.dispose(); });
    it('should prefer the code field', () => { app.server.options.generatedApis?.routePrefix?.should.equal('code'); });
    it('should retain configured sibling fields', () => { app.server.options.generatedApis?.includeCommandNameInRoute?.should.equal(true); });
    it('should override exception exposure without disabling development features', () => {
        app.server.options.exposeExceptionDetails?.should.equal(false);
        app.server.options.development?.should.equal(true);
    });
    it('should override a hosting field', () => { app.server.options.hosting?.maxBodyBytes?.should.equal(512); });
    it('should merge code query limits with configured siblings', () => {
        app.server.options.query?.maxObservableSubscriptions?.should.equal(12);
        app.server.options.query?.maxObservableSubscriptionsPerCaller?.should.equal(3);
        app.server.options.query?.keepAliveIntervalMs?.should.equal(5000);
    });
    it('should not install authentication implicitly', () => { (app.server.options.authentication ?? []).length.should.equal(0); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Items } from '../given/Items.js';
import { PrepareItem } from '../given/PrepareItem.js';

describe('when executing a prepared command with an injected service', () => {
    let result: { response: string; isSuccess: boolean };
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ development: true });
        builder.services.addSingleton(Items);
        builder.add(PrepareItem);
        const application = await builder.build();
        try {
            const response = (await application.server.handle(new Request('http://localhost/api/prepare-item', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"prepared"}'
            })))!;
            result = await response.json();
        } finally { await application.dispose(); }
    });
    it('should pass preparation before the service on the same command instance', () => {
        result.response.should.equal('PREPARED');
    });
});

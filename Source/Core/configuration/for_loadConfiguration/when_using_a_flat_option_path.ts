// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

describe('when a removed flat option path is supplied', () => {
    let warning: string;
    let correlationHeader: string | undefined;
    beforeEach(() => {
        const settings = loadConfiguration('/nonexistent/appsettings.json', {
            Cratis__Arc__CorrelationHeader: 'X-Old-Correlation'
        }, error => { warning = String(error); });
        correlationHeader = settings.Cratis?.Arc?.correlationId?.httpHeader;
    });
    it('should report the unknown flat key without binding it', () => {
        warning.should.contain('Cratis:Arc:CorrelationHeader');
        should().equal(correlationHeader, undefined);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { AuthenticationStatus, identityDetailsProvider } from '../index.js';
import { given } from '../given.js';
import { an_application_builder } from './given/an_application_builder.js';

class PersonalDetails { @field(String) label!: string; }
@identityDetailsProvider()
class DetailsProvider {
    detailsType = PersonalDetails;
    provide(): PersonalDetails { return Object.assign(new PersonalDetails(), { label: 'Hello' }); }
}
@identityDetailsProvider()
class OtherProvider {
    detailsType = PersonalDetails;
    provide(): PersonalDetails { return Object.assign(new PersonalDetails(), { label: 'Other' }); }
}

describe('when discovering an identity details provider', given(an_application_builder, context => {
    let schema: Response;
    let identity: Response;
    beforeEach(async () => {
        const application = await context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'alice', roles: [], isAuthenticated: true } })] }).add(DetailsProvider).build();
        try {
            schema = (await application.server.handle(new Request('http://localhost/.cratis/identity-details/schema')))!;
            identity = (await application.server.handle(new Request('http://localhost/.cratis/me')))!;
        } finally { await application.dispose(); }
    });
    it('should derive the schema from model-bound fields', async () => {
        (await schema.json()).properties.label.type.should.equal('string');
    });
    it('should return matching identity details', async () => {
        (await identity.json()).details.label.should.equal('Hello');
    });
    it('should set a display-only cookie', () => {
        identity.headers.get('set-cookie')!.should.contain('SameSite=Lax');
        identity.headers.get('set-cookie')!.should.not.contain('HttpOnly');
    });
}));

describe('when an explicit identity details provider conflicts with discovery', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        try { await context.create({ identityDetails: { detailsType: PersonalDetails,
            provide: () => Object.assign(new PersonalDetails(), { label: 'Explicit' }) } }).add(DetailsProvider).build(); }
        catch (failure) { error = failure; }
    });
    it('should fail rather than silently ignoring the discovered provider', () => {
        String(error).should.contain('Explicit and discovered identity details providers cannot be combined');
    });
}));

describe('when multiple identity details providers are discovered', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        try { await context.create().add(DetailsProvider, OtherProvider).build(); }
        catch (failure) { error = failure; }
    });
    it('should fail instead of choosing a provider silently', () => {
        String(error).should.contain('Multiple identity details providers found');
    });
}));

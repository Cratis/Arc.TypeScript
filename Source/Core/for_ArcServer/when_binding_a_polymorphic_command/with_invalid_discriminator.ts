// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { should } from 'vitest';
import { given } from '../../given.js';
import { ArcApplication } from '../../ArcApplication.js';
import { command } from '../../commands/modelBound/command.js';
import { MessageBase } from '../../reflection/for_wireSchema/given/MessageBase.js';
import '../../reflection/for_wireSchema/given/TextMessage.js';
should();

@command()
class SendMessage {
    @field(MessageBase) message!: MessageBase;
    handle(): string { return this.message.title; }
}
class a_polymorphic_command {
    async request(message: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
        const builder = ArcApplication.createBuilder();
        builder.add(SendMessage);
        const application = await builder.build();
        try {
            const response = (await application.server.handle(new Request('http://localhost/api/send-message', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message })
            })))!;
            return { status: response.status, body: await response.json() as Record<string, unknown> };
        } finally { await application.dispose(); }
    }
}
describe('when binding a polymorphic command with an invalid discriminator', given(a_polymorphic_command, context => {
    it('should reject a missing discriminator through HTTP', async () => {
        const result = await context.request({ title: 'hello', text: 'world' });
        result.status.should.equal(400);
        (result.body.isSuccess === false).should.equal(true);
    });
    it('should reject an unknown discriminator through HTTP', async () => {
        const result = await context.request({ title: 'hello', text: 'world', _derivedTypeId: 'unknown' });
        result.status.should.equal(400);
        (result.body.isSuccess === false).should.equal(true);
    });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ArcApplication } from '@cratis/arc.core';
import { renderGeneratedMetadata } from '../../../Tools/ProxyGenerator/renderGeneratedMetadata.js';
import { RegisterTask, RegisterTaskValidator } from '../../../../Samples/Tasks/Features/Tasks/Registration/Registration.js';
import { TaskId } from '../../../../Samples/Tasks/Features/Tasks/TaskId.js';
import { Tasks } from '../../../../Samples/Tasks/Features/Tasks/Tasks.js';
import { TaskItem } from '../../../../Samples/Tasks/Features/Tasks/Listing/Listing.js';
import { metadata } from '../../../../Samples/Tasks/Features/generatedMetadata.js';
import { mountExpress } from '../../index.js';

const sample = join(dirname(fileURLToPath(import.meta.url)), '../../../../Samples/Tasks');

describe('when serving generated command and query metadata over Express', () => {
    let listener: Server;
    let application: ArcApplication;
    let command: Response;
    let query: Response;
    beforeEach(async () => {
        const file = join(sample, 'Features/generatedMetadata.ts');
        const source = renderGeneratedMetadata(join(sample, 'tsconfig.json'), join(sample, 'Features'), file);
        const stored = (await readFile(file, 'utf8')).replace(/ Hash: [a-f0-9]{64}/, '');
        stored.should.equal(source);
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata(metadata);
        builder.services.addSingleton(Tasks);
        builder.add(RegisterTask, RegisterTaskValidator, TaskItem);
        application = await builder.build();
        const host = express();
        mountExpress(host, application);
        listener = createServer(host);
        await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('Missing HTTP port');
        const base = `http://127.0.0.1:${address.port}/api`;
        const id = TaskId.create().value.toString();
        command = await fetch(`${base}/register-task`, { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, title: 'From HTTP' }) });
        query = await fetch(`${base}/task-by-id?id=${encodeURIComponent(id)}`);
    });
    afterEach(async () => {
        if (listener) await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        if (application) await application.dispose();
    });
    it('should execute the token-free command through HTTP', async () => {
        command.status.should.equal(200);
        (await command.json() as { response: string }).response.should.be.a('string');
    });
    it('should decode the generated query argument and resolve its service', async () => {
        query.status.should.equal(200);
        (await query.json() as { data: { title: string } }).data.title.should.equal('From HTTP');
    });
});

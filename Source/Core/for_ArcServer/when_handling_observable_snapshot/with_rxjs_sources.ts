// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { BehaviorSubject, Observable, ReplaySubject, Subject } from 'rxjs';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with RxJS sources', () => {
    async function snapshot(source: Observable<number>, wait = false): Promise<{ status: number; data: number | undefined }> {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => source
        })] });
        try {
            const url = `http://localhost/api/value${wait ? '?waitForFirstResult=true' : ''}`;
            const response = (await server.handle(new Request(url)))!;
            return { status: response.status, data: (await response.json()).data };
        } finally { await server.dispose(); }
    }

    it('should return the BehaviorSubject current value immediately', async () => {
        const result = await snapshot(new BehaviorSubject(42));
        result.status.should.equal(200);
        result.data!.should.equal(42);
    });

    it('should leave a ReplaySubject pending without an explicit current value', async () => {
        const source = new ReplaySubject<number>(1);
        source.next(7);
        (await snapshot(source)).status.should.equal(202);
    });

    it('should wait for a ReplaySubject replay when requested', async () => {
        const source = new ReplaySubject<number>(1);
        source.next(7);
        const result = await snapshot(source, true);
        result.status.should.equal(200);
        result.data!.should.equal(7);
    });

    it('should leave a Subject pending', async () => {
        (await snapshot(new Subject<number>())).status.should.equal(202);
    });

    it('should leave an Observable without a current value pending', async () => {
        (await snapshot(new Observable<number>(() => {}))).status.should.equal(202);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Dirent } from 'node:fs';
import sinon from 'sinon';
import { SourceWatchMonitor } from '../../SourceWatchMonitor.js';
import { SourceWatchReader } from '../../SourceWatchReader.js';
import type { SourceWatchEntry } from '../../SourceWatchEntry.js';

export class a_source_watch {
    reader = sinon.createStubInstance(SourceWatchReader);
    changed = sinon.stub();
    failed = sinon.stub();
    clock!: sinon.SinonFakeTimers;
    monitor!: SourceWatchMonitor;

    async establish(interval = 1000, entry: SourceWatchEntry = { signature: 'before' }): Promise<void> {
        this.clock = sinon.useFakeTimers({ now: 10000, toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
        this.reader.directory.reset();
        this.reader.directory.resolves([{ name: 'Save.ts', isDirectory: () => false } as Dirent]);
        this.reader.isDirectory.reset();
        this.reader.isDirectory.resolves(false);
        this.reader.file.reset();
        this.reader.file.resolves(entry);
        this.changed.reset();
        this.failed.reset();
        this.monitor = new SourceWatchMonitor('/artifacts', new Set(['/external/Service.ts']),
            path => path.endsWith('.proxy.ts') || path === '/artifacts/metadata.ts' || path.startsWith('/artifacts/generated/'),
            interval, this.changed, this.failed, this.reader);
        await this.monitor.start();
        this.reader.directory.resetHistory();
        this.reader.file.resetHistory();
    }

    async cleanup(): Promise<void> {
        await this.monitor.stop();
        this.clock.restore();
    }
}

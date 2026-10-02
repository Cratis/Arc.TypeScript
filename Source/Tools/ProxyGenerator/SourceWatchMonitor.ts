// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sep } from 'node:path';
import type { SourceWatchEntry } from './SourceWatchEntry.js';
import { SourceWatchReader } from './SourceWatchReader.js';
import { sourceWatchSnapshot } from './sourceWatchSnapshot.js';

/** Reconcile cheap per-file notifications with an adaptive, optional tree fallback. */
export class SourceWatchMonitor {
    private entries = new Map<string, SourceWatchEntry>();
    private duringScan?: Set<string>;
    private readonly pending = new Map<string, Promise<void>>();
    private readonly dirty = new Set<string>();
    private timer?: NodeJS.Timeout;
    private scanning?: Promise<void>;
    private stopped = false;

    constructor(private readonly root: string, private readonly externalFiles: ReadonlySet<string>,
        private readonly excluded: (path: string) => boolean, private readonly interval: number,
        private readonly changed: () => void, private readonly failed: (error: unknown) => void,
        private readonly reader = new SourceWatchReader(root)) {}

    async start(): Promise<void> {
        const start = performance.now();
        this.entries = await sourceWatchSnapshot(this.root, this.externalFiles, this.excluded, this.reader);
        this.arm(performance.now() - start);
    }

    async notify(path: string): Promise<void> {
        if (this.stopped || this.excluded(path)) return;
        const local = path.startsWith(this.root + sep) && path.endsWith('.ts') && !path.endsWith('.d.ts') &&
            !path.includes(`${sep}node_modules${sep}`) && !path.includes(`${sep}.git${sep}`);
        if (!local && !this.externalFiles.has(path)) return;
        if (this.pending.has(path)) {
            this.dirty.add(path);
            return this.pending.get(path);
        }
        const work = this.checkFile(path).catch(this.failed).finally(() => { this.pending.delete(path); });
        this.pending.set(path, work);
        return work;
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        await Promise.all([this.scanning, ...this.pending.values()]);
    }

    private async checkFile(path: string): Promise<void> {
        do {
            this.dirty.delete(path);
            const current = await this.reader.file(path, this.entries.get(path)?.hash !== undefined);
            this.duringScan?.add(path);
            if (this.update(path, current) && !this.stopped) this.changed();
        } while (!this.stopped && this.dirty.has(path));
    }

    private update(path: string, current: SourceWatchEntry | undefined): boolean {
        const previous = this.entries.get(path);
        const changed = previous?.signature !== current?.signature ||
            previous?.hash !== undefined && current?.hash !== undefined && previous.hash !== current.hash;
        if (current) this.entries.set(path, current);
        else this.entries.delete(path);
        return changed;
    }

    private arm(duration: number): void {
        if (this.stopped || this.interval === 0) return;
        const delay = Math.min(2_147_483_647, Math.max(this.interval, Math.ceil(4 * duration)));
        this.timer = setTimeout(() => {
            this.scanning = this.reconcile().catch(this.failed);
        }, delay);
    }

    private async reconcile(): Promise<void> {
        const start = performance.now();
        this.duringScan = new Set();
        try {
            const current = await sourceWatchSnapshot(this.root, this.externalFiles, this.excluded, this.reader);
            let changed = false;
            for (const path of new Set([...this.entries.keys(), ...current.keys()])) {
                // Native checks can run during a large tree scan. Do not roll their fresher observations back.
                if (this.pending.has(path) || this.duringScan.has(path)) continue;
                changed = this.update(path, current.get(path)) || changed;
            }
            if (changed && !this.stopped) this.changed();
            this.arm(performance.now() - start);
        } finally { this.duringScan = undefined; }
    }
}

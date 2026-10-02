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
    private scanRequested = false;
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
        const local = path.startsWith(this.root + sep) &&
            !path.slice(this.root.length + 1).split(sep).some(part => part === 'node_modules' || part === '.git');
        const source = this.externalFiles.has(path) || local && path.endsWith('.ts') && !path.endsWith('.d.ts');
        if (!local && !source) return;
        if (this.pending.has(path)) {
            this.dirty.add(path);
            return this.pending.get(path);
        }
        const work = this.checkPath(path, source).catch(this.failed).finally(() => { this.pending.delete(path); });
        this.pending.set(path, work);
        return work;
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        await Promise.all([this.scanning, ...this.pending.values()]);
    }

    private async checkPath(path: string, source: boolean): Promise<void> {
        do {
            this.dirty.delete(path);
            if (source) {
                const current = await this.reader.file(path, this.entries.get(path)?.hash !== undefined);
                this.duringScan?.add(path);
                if (this.update(path, current) && !this.stopped) this.changed();
            } else {
                const directory = await this.reader.isDirectory(path);
                // A moved-in directory is visible on disk; a removed directory survives only in the checkpoint.
                if (directory || directory === undefined && [...this.entries.keys()].some(file => file.startsWith(path + sep)))
                    await this.requestReconcile();
            }
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
        this.timer = setTimeout(() => { void this.requestReconcile(); }, delay);
    }

    private requestReconcile(): Promise<void> {
        if (this.stopped) return Promise.resolve();
        if (this.timer) clearTimeout(this.timer);
        this.scanRequested = true;
        // Also honor requests arriving after the drain loop ends but before its promise is cleared.
        if (this.scanning) return this.scanning.then(() => this.scanRequested ? this.requestReconcile() : this.scanning);
        this.scanning = this.reconcileRequested().catch(this.failed).finally(() => { this.scanning = undefined; });
        return this.scanning;
    }

    private async reconcileRequested(): Promise<void> {
        let duration: number;
        do {
            this.scanRequested = false;
            duration = await this.reconcile();
        } while (this.scanRequested && !this.stopped);
        this.arm(duration);
    }

    private async reconcile(): Promise<number> {
        const start = performance.now();
        this.duringScan = new Set();
        try {
            const current = await sourceWatchSnapshot(this.root, this.externalFiles, this.excluded, this.reader,
                path => this.entries.get(path)?.hash !== undefined);
            let changed = false;
            for (const path of new Set([...this.entries.keys(), ...current.keys()])) {
                // Native checks can run during a large tree scan. Do not roll their fresher observations back.
                if (this.pending.has(path) || this.duringScan.has(path)) continue;
                changed = this.update(path, current.get(path)) || changed;
            }
            if (changed && !this.stopped) this.changed();
            return performance.now() - start;
        } finally { this.duringScan = undefined; }
    }
}

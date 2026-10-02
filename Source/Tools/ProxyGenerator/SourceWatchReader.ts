// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import type { SourceWatchEntry } from './SourceWatchEntry.js';

/** Bound filesystem concurrency and keep disappearing or inaccessible children from stopping watch mode. */
export class SourceWatchReader {
    private readonly warned = new Set<string>();
    private readonly waiting: (() => void)[] = [];
    private active = 0;

    constructor(private readonly root: string) {}

    skipped(path: string, error: unknown): void {
        const code = (error as NodeJS.ErrnoException).code;
        // Disappearance is normal during editor saves and deletions. Other entry failures are reported once.
        if (code === 'ENOENT' || code === 'ENOTDIR' || this.warned.has(path)) return;
        this.warned.add(path);
        console.warn(`Watch skipped ${path}: ${code ?? String(error)}`);
    }

    async directory(path: string): Promise<Dirent[]> {
        return this.limited(async () => {
            try { return await fs.readdir(path, { withFileTypes: true }); }
            catch (error) {
                if (path === this.root) throw error;
                this.skipped(path, error);
                return [];
            }
        });
    }

    async file(path: string, compareHash = false): Promise<SourceWatchEntry | undefined> {
        return this.limited(async () => {
            try {
                const current = await fs.stat(path, { bigint: true });
                if (!current.isFile()) return undefined;
                const recent = Math.abs(Date.now() - Number(current.mtimeNs / 1_000_000n)) <= 2000;
                // A coarse timestamp can conceal an equal-sized edit. Hash recent entries at the
                // checkpoint and again on native events, even if that event arrives much later.
                const hash = recent || compareHash ? createHash('sha256').update(await fs.readFile(path)).digest('hex') : undefined;
                return { signature: `${current.mtimeNs}:${current.ctimeNs}:${current.size}:${current.ino}`, hash };
            } catch (error) {
                if (path === this.root) throw error;
                this.skipped(path, error);
                return undefined;
            }
        });
    }

    private async limited<T>(operation: () => Promise<T>): Promise<T> {
        if (this.active === 32) await new Promise<void>(resolve => this.waiting.push(resolve));
        else this.active++;
        try { return await operation(); }
        finally {
            const next = this.waiting.shift();
            if (next) next();
            else this.active--;
        }
    }
}

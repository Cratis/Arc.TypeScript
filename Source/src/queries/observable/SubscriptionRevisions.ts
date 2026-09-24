// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

interface RevisionState {
    revision?: number;
    active: boolean;
    requestKey?: string;
    tombstoneAt?: number;
}

const retentionMs = 2 * 60 * 1000;
const maximumTombstones = 1024;

/** Atomic per-query revision precedence with bounded, expiring unsubscribe tombstones. */
export class SubscriptionRevisions {
    readonly #states = new Map<string, RevisionState>();

    static valid(revision: unknown): revision is number {
        return typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0;
    }

    get activeCount(): number {
        return [...this.#states.values()].filter(state => state.active).length;
    }

    isActive(queryId: string, revision?: number): boolean {
        const state = this.#states.get(queryId);
        return state?.active === true && state.revision === revision;
    }

    subscribe(queryId: string, revision: number | undefined, requestKey: string, now = Date.now()): boolean {
        this.prune(now);
        const existing = this.#states.get(queryId);
        if (existing?.revision !== undefined) {
            if (revision === undefined || revision <= existing.revision) return false;
        } else if (revision === undefined && existing?.active && existing.requestKey === requestKey) return false;
        this.#states.delete(queryId);
        this.#states.set(queryId, { revision, active: true, requestKey });
        return true;
    }

    unsubscribe(queryId: string, revision?: number, now = Date.now()): boolean {
        this.prune(now);
        const existing = this.#states.get(queryId);
        if (existing?.revision !== undefined) {
            if (revision === undefined || revision < existing.revision) return false;
        } else if (revision === undefined && !existing?.active) return false;
        if (revision === undefined) {
            this.#states.delete(queryId);
            return true;
        }
        this.#states.delete(queryId);
        this.#states.set(queryId, { revision, active: false, tombstoneAt: now });
        this.prune(now);
        return true;
    }

    complete(queryId: string, revision?: number, now = Date.now()): void {
        if (!this.isActive(queryId, revision)) return;
        this.unsubscribe(queryId, revision, now);
    }

    private prune(now: number): void {
        for (const [id, state] of this.#states) {
            if (!state.active && state.tombstoneAt !== undefined && now - state.tombstoneAt >= retentionMs)
                this.#states.delete(id);
        }
        const tombstones = [...this.#states].filter(([, state]) => !state.active && state.tombstoneAt !== undefined);
        for (let index = 0; index < tombstones.length - maximumTombstones; index++)
            this.#states.delete(tombstones[index]![0]);
    }
}

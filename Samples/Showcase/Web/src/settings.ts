// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Globals, ObservableQueryTransferMode } from '@cratis/arc';
import { QueryTransportMethod } from '@cratis/arc/queries';

export interface Settings {
    transport: 'webSocket' | 'serverSentEvents';
    connections: number;
    direct: boolean;
    transfer: 'full' | 'delta';
}

const key = 'showcase-settings';
const defaults: Settings = { transport: 'webSocket', connections: 1, direct: false, transfer: 'full' };

export function loadSettings(): Settings {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<Settings> }; }
    catch { return defaults; }
}

/** Store the settings; a subscription captures them when it opens, so the page reloads to apply them everywhere. */
export function saveSettings(settings: Settings): void {
    localStorage.setItem(key, JSON.stringify(settings));
    location.reload();
}

/** Apply the stored settings to the Arc client before anything subscribes. */
export function applySettings(): Settings {
    const settings = loadSettings();
    Globals.queryTransportMethod = settings.transport === 'serverSentEvents' ? QueryTransportMethod.ServerSentEvents : QueryTransportMethod.WebSocket;
    Globals.queryConnectionCount = settings.connections;
    Globals.queryDirectMode = settings.direct;
    Globals.observableQueryTransferMode = settings.transfer === 'delta' ? ObservableQueryTransferMode.Delta : ObservableQueryTransferMode.Full;
    return settings;
}

export interface Session { user: string | null; tenant: string }

export async function loadSession(): Promise<Session> { return await (await fetch('/showcase/session')).json() as Session; }

export async function changeSession(change: Partial<Session>): Promise<void> {
    await fetch('/showcase/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) });
    location.reload();
}

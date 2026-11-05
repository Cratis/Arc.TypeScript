// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useEffect, useState } from 'react';
import { changeSession, loadSession, saveSettings, type Session, type Settings } from './settings';

/** Transport, connection count, direct mode, transfer mode, tenant and sign-in. Changing one reloads the page. */
export function Toolbar({ settings }: { settings: Settings }) {
    const [session, setSession] = useState<Session>();
    useEffect(() => { void loadSession().then(setSession); }, []);
    const change = (values: Partial<Settings>) => saveSettings({ ...settings, ...values });
    return <header>
        <strong>Arc for TypeScript · Showcase</strong>
        <label>Transport <select value={settings.transport} onChange={event => change({ transport: event.target.value as Settings['transport'] })}>
            <option value="webSocket">WebSocket</option><option value="serverSentEvents">SSE</option></select></label>
        <label>Connections <select value={settings.connections} onChange={event => change({ connections: Number(event.target.value) })}>
            {[1, 2, 4].map(count => <option key={count}>{count}</option>)}</select></label>
        <label><input type="checkbox" checked={settings.direct} onChange={event => change({ direct: event.target.checked })} /> Direct</label>
        <label>Transfer <select value={settings.transfer} onChange={event => change({ transfer: event.target.value as Settings['transfer'] })}>
            <option value="full">Full</option><option value="delta">Delta</option></select></label>
        <label>Tenant <select value={session?.tenant ?? 'default'} onChange={event => void changeSession({ tenant: event.target.value })}>
            {['default', 'acme', 'globex'].map(tenant => <option key={tenant}>{tenant}</option>)}</select></label>
        <label>User <select value={session?.user ?? ''} onChange={event => void changeSession({ user: event.target.value || null })}>
            <option value="">Anonymous</option><option value="ada">Ada (admin)</option><option value="grace">Grace (reader)</option></select></label>
    </header>;
}

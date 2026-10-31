import { useEffect, useState } from 'preact/hooks';

import {
    deleteVpnCredentials,
    getVpnCredentials,
    upsertVpnCredentials,
    type VpnCredentials,
} from '../api';
import { tsToHuman } from '../util';

// ADR 190 — per-user VPN credentials widget on the user detail
// page. Pairs with the VpnPanel servers UI from ADR 187: the
// admin API endpoints existed there but the only way to set
// per-user credentials was a raw curl against
// PUT /admin/v1/vpn/credentials/:userId. This widget closes that
// gap.

interface Props {
    userId: string;
}

export function VpnCredentialsEditor({ userId }: Props) {
    const [creds, setCreds] = useState<VpnCredentials | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [groupId, setGroupId] = useState('');
    const [maxConnect, setMaxConnect] = useState('1');
    const [showPassword, setShowPassword] = useState(false);

    const reload = async () => {
        setLoading(true);
        setError(null);
        try {
            const c = await getVpnCredentials(userId);
            setCreds(c);
            if (c) {
                setName(c.Name);
                setPassword(c.Password);
                setGroupId(c.GroupID);
                setMaxConnect(String(c.MaxConnect));
            } else {
                setName('');
                setPassword('');
                setGroupId('');
                setMaxConnect('1');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void reload(); }, [userId]);

    const startEdit = () => {
        setEditing(true);
        setError(null);
    };
    const cancel = () => {
        setEditing(false);
        setError(null);
        if (creds) {
            setName(creds.Name);
            setPassword(creds.Password);
            setGroupId(creds.GroupID);
            setMaxConnect(String(creds.MaxConnect));
        }
    };

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            if (!name.trim() || !password.trim()) {
                throw new Error('Name and password are required');
            }
            const next = Math.max(1, Number(maxConnect) || 1);
            const r = await upsertVpnCredentials(userId, {
                Name: name.trim(),
                Password: password,
                GroupID: groupId.trim(),
                MaxConnect: next,
            });
            setCreds(r.Credentials);
            setEditing(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Clear VPN credentials for this user?')) return;
        setBusy(true);
        setError(null);
        try {
            await deleteVpnCredentials(userId);
            setCreds(null);
            setEditing(false);
            setName('');
            setPassword('');
            setGroupId('');
            setMaxConnect('1');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div class="panel">
            <h3>VPN credentials</h3>
            <p class="dim" style="margin: -4px 0 12px; font-size: 12px;">
                OpenVPN username / password (or WireGuard public-key identifier
                + private key) the VPN-Settings client app surfaces in{' '}
                <code>/vpn/v2</code>. Per ADR 187; tunnels are operated by
                whatever backend you've wired to the servers in the VPN tab.
            </p>
            {error && <div class="error">{error}</div>}
            {loading ? (
                <p class="dim">loading…</p>
            ) : creds === null && !editing ? (
                <>
                    <p class="dim">No credentials set. /vpn/v2 returns Status=0
                    for this user (plan-derived metadata still surfaces if their
                    plan grants VPN).</p>
                    <button class="primary" onClick={startEdit}>Set credentials</button>
                </>
            ) : !editing ? (
                <>
                    <div class="kv">
                        <div class="k">Name</div>
                        <div class="v"><code>{creds!.Name}</code></div>
                        <div class="k">Password</div>
                        <div class="v">
                            <code>{showPassword ? creds!.Password : '••••••••'}</code>{' '}
                            <button onClick={() => setShowPassword((p) => !p)}>
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <div class="k">Group ID</div>
                        <div class="v">{creds!.GroupID || <span class="dim">—</span>}</div>
                        <div class="k">Max connect</div>
                        <div class="v">{creds!.MaxConnect}</div>
                        <div class="k">Updated</div>
                        <div class="v">{tsToHuman(
                            Math.floor(new Date(creds!.UpdatedAt).getTime() / 1000),
                        )}</div>
                    </div>
                    <div class="row" style="gap: 8px; margin-top: 12px;">
                        <button onClick={startEdit}>Edit</button>
                        <button onClick={() => void remove()} disabled={busy}>Clear</button>
                    </div>
                </>
            ) : (
                <>
                    <div class="row" style="gap: 16px; flex-wrap: wrap;">
                        <label>
                            Name
                            <input value={name}
                                onInput={(e) =>
                                    setName((e.currentTarget as HTMLInputElement).value)}
                                placeholder="alice-vpn" />
                        </label>
                        <label>
                            Password
                            <input type={showPassword ? 'text' : 'password'}
                                value={password}
                                onInput={(e) =>
                                    setPassword((e.currentTarget as HTMLInputElement).value)} />
                            <button type="button"
                                style="margin-left: 6px;"
                                onClick={() => setShowPassword((p) => !p)}>
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </label>
                        <label>
                            Group ID
                            <input value={groupId}
                                onInput={(e) =>
                                    setGroupId((e.currentTarget as HTMLInputElement).value)}
                                placeholder="(optional)" />
                        </label>
                        <label>
                            Max connect
                            <input type="number" min={1} max={100}
                                value={maxConnect}
                                onInput={(e) =>
                                    setMaxConnect((e.currentTarget as HTMLInputElement).value)}
                                style="width: 80px;" />
                        </label>
                    </div>
                    <div class="row" style="gap: 8px; margin-top: 12px;">
                        <button class="primary" onClick={save} disabled={busy}>
                            {creds === null ? 'Create' : 'Save'}
                        </button>
                        <button onClick={cancel} disabled={busy}>Cancel</button>
                    </div>
                </>
            )}
        </div>
    );
}

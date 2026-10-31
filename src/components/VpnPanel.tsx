import { useEffect, useState } from 'preact/hooks';

import {
    createVpnServer,
    deleteVpnServer,
    listVpnServers,
    updateVpnServer,
    type VpnServer,
    type VpnServerInput,
} from '../api';

// ADR 187 — godmode VPN management. Operator pastes either an
// OpenVPN .ovpn template or a WireGuard .conf file into the
// "Config blob" textarea and the server stores it verbatim. The
// VPN-Settings client app sees the server in /vpn/v1/logicals
// and can download the blob via /vpn/v1/config.

interface Draft {
    Name: string;
    EntryCountry: string;
    ExitCountry: string;
    City: string;
    Tier: string;
    Domain: string;
    EntryIP: string;
    ExitIP: string;
    Load: string;
    Status: string;
    Lat: string;
    Lon: string;
    Protocol: 'openvpn' | 'wireguard';
    ConfigBlob: string;
}

const emptyDraft: Draft = {
    Name: '',
    EntryCountry: '',
    ExitCountry: '',
    City: '',
    Tier: '0',
    Domain: '',
    EntryIP: '',
    ExitIP: '',
    Load: '30',
    Status: '1',
    Lat: '0',
    Lon: '0',
    Protocol: 'openvpn',
    ConfigBlob: '',
};

function rowToDraft(s: VpnServer): Draft {
    return {
        Name: s.Name,
        EntryCountry: s.EntryCountry,
        ExitCountry: s.ExitCountry,
        City: s.City ?? '',
        Tier: String(s.Tier),
        Domain: s.Domain,
        EntryIP: s.EntryIP,
        ExitIP: s.ExitIP,
        Load: String(s.Load),
        Status: String(s.Status),
        Lat: String(s.Lat),
        Lon: String(s.Lon),
        Protocol: s.Protocol,
        ConfigBlob: s.ConfigBlob ?? '',
    };
}

function draftToPayload(d: Draft): VpnServerInput {
    return {
        Name: d.Name.trim(),
        EntryCountry: d.EntryCountry.trim().toUpperCase(),
        ExitCountry: d.ExitCountry.trim() ? d.ExitCountry.trim().toUpperCase() : undefined,
        City: d.City.trim() || null,
        Tier: Number(d.Tier),
        Domain: d.Domain.trim(),
        EntryIP: d.EntryIP.trim(),
        ExitIP: d.ExitIP.trim() || undefined,
        Load: Number(d.Load),
        Status: Number(d.Status),
        Lat: d.Lat ? Number(d.Lat) : 0,
        Lon: d.Lon ? Number(d.Lon) : 0,
        Protocol: d.Protocol,
        ConfigBlob: d.ConfigBlob.trim() || null,
    };
}

// Best-effort sniff of a pasted config to pre-populate common fields.
// OpenVPN: looks for `remote <host> [port]` line.
// WireGuard: looks for `Endpoint = <host>:<port>` line under [Peer].
function autoFillFromConfigBlob(d: Draft): Draft {
    const blob = d.ConfigBlob;
    if (!blob) return d;
    const next = { ...d };
    const isWireguard = /^\s*\[(Interface|Peer)\]/m.test(blob);
    if (isWireguard) {
        next.Protocol = 'wireguard';
        const endpoint = /^Endpoint\s*=\s*([^\s:]+)(?::(\d+))?/m.exec(blob);
        if (endpoint) {
            if (!next.Domain) next.Domain = endpoint[1]!;
            if (!next.EntryIP) {
                const ipMatch = /^\d+\.\d+\.\d+\.\d+$/.test(endpoint[1]!);
                if (ipMatch) next.EntryIP = endpoint[1]!;
            }
        }
    } else if (/^\s*remote\s+/m.test(blob)) {
        next.Protocol = 'openvpn';
        const remote = /^remote\s+(\S+)/m.exec(blob);
        if (remote) {
            const host = remote[1]!;
            if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
                if (!next.EntryIP) next.EntryIP = host;
            } else if (!next.Domain) {
                next.Domain = host;
            }
        }
    }
    return next;
}

export function VpnPanel() {
    const [servers, setServers] = useState<VpnServer[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [creating, setCreating] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = async () => {
        try {
            const { Servers } = await listVpnServers();
            setServers(Servers);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    useEffect(() => { void reload(); }, []);

    const startCreate = () => {
        setCreating(true);
        setEditingId(null);
        setDraft({ ...emptyDraft });
    };
    const startEdit = (s: VpnServer) => {
        setCreating(false);
        setEditingId(s.ID);
        setDraft(rowToDraft(s));
    };
    const cancel = () => {
        setCreating(false);
        setEditingId(null);
        setDraft(emptyDraft);
        setError(null);
    };
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const payload = draftToPayload(draft);
            if (creating) {
                if (!payload.Name || !payload.EntryCountry || !payload.Domain || !payload.EntryIP) {
                    throw new Error('Name, EntryCountry, Domain, EntryIP are required');
                }
                await createVpnServer(payload);
            } else if (editingId) {
                await updateVpnServer(editingId, payload);
            }
            cancel();
            await reload();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const remove = async (id: string) => {
        if (!confirm('Delete this VPN server?')) return;
        setBusy(true);
        try {
            await deleteVpnServer(id);
            await reload();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const isEditing = creating || editingId !== null;
    const updateField = <K extends keyof Draft>(k: K, v: Draft[K]) =>
        setDraft((prev) => ({ ...prev, [k]: v }));
    const updateConfigBlob = (v: string) =>
        setDraft((prev) => autoFillFromConfigBlob({ ...prev, ConfigBlob: v }));

    return (
        <>
            <h2>VPN servers</h2>
            <p class="dim" style="margin: -4px 0 16px; font-size: 13px;">
                Operator-managed VPN backend. Paste an OpenVPN .ovpn template
                or WireGuard .conf file into Config blob; the client downloads
                it via <code>/vpn/v1/config?LogicalID=…</code>. Per-user
                Name/Password credentials are managed from each user's
                detail page (see Users → user → VPN section).
            </p>
            <div class="panel">
                <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
                    <strong>{servers.length} server{servers.length === 1 ? '' : 's'}</strong>
                    {!isEditing && (
                        <button class="primary" onClick={startCreate}>Add server</button>
                    )}
                </div>
                {error && <div class="error">{error}</div>}
                {servers.length === 0 && !isEditing && (
                    <p class="dim">No servers yet. Click Add server to wire one up.</p>
                )}
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align:left;">Name</th>
                            <th style="text-align:left;">Country</th>
                            <th style="text-align:left;">Protocol</th>
                            <th style="text-align:left;">Tier</th>
                            <th style="text-align:left;">Domain</th>
                            <th style="text-align:left;">Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {servers.map((s) => (
                            <tr key={s.ID}>
                                <td>{s.Name}</td>
                                <td>{s.EntryCountry}{s.ExitCountry !== s.EntryCountry ? ` → ${s.ExitCountry}` : ''}</td>
                                <td>{s.Protocol}</td>
                                <td>{s.Tier}</td>
                                <td><code>{s.Domain}</code></td>
                                <td>{s.Status === 1 ? 'enabled' : 'disabled'}</td>
                                <td style="text-align:right;">
                                    <button onClick={() => startEdit(s)}>Edit</button>
                                    {' '}
                                    <button onClick={() => void remove(s.ID)} disabled={busy}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isEditing && (
                <div class="panel">
                    <h3>{creating ? 'New VPN server' : `Edit ${draft.Name}`}</h3>
                    <div class="row" style="gap:16px; flex-wrap:wrap;">
                        <label>
                            Name
                            <input value={draft.Name}
                                onInput={(e) => updateField('Name', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="Helsinki #1" />
                        </label>
                        <label>
                            Entry country
                            <input value={draft.EntryCountry}
                                onInput={(e) => updateField('EntryCountry', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="FI" maxLength={2} style="width:60px;" />
                        </label>
                        <label>
                            Exit country
                            <input value={draft.ExitCountry}
                                onInput={(e) => updateField('ExitCountry', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="(same as entry)" maxLength={2} style="width:120px;" />
                        </label>
                        <label>
                            City
                            <input value={draft.City}
                                onInput={(e) => updateField('City', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="Helsinki" />
                        </label>
                    </div>
                    <div class="row" style="gap:16px; flex-wrap:wrap;">
                        <label>
                            Protocol
                            <select value={draft.Protocol}
                                onChange={(e) => updateField('Protocol',
                                    (e.currentTarget as HTMLSelectElement).value as 'openvpn' | 'wireguard')}>
                                <option value="openvpn">OpenVPN</option>
                                <option value="wireguard">WireGuard</option>
                            </select>
                        </label>
                        <label>
                            Tier
                            <select value={draft.Tier}
                                onChange={(e) => updateField('Tier', (e.currentTarget as HTMLSelectElement).value)}>
                                <option value="0">Free (0)</option>
                                <option value="1">Basic (1)</option>
                                <option value="2">Plus (2)</option>
                            </select>
                        </label>
                        <label>
                            Domain
                            <input value={draft.Domain}
                                onInput={(e) => updateField('Domain', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="fi-1.vpn.example.com" />
                        </label>
                        <label>
                            Entry IP
                            <input value={draft.EntryIP}
                                onInput={(e) => updateField('EntryIP', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="1.2.3.4" />
                        </label>
                        <label>
                            Exit IP
                            <input value={draft.ExitIP}
                                onInput={(e) => updateField('ExitIP', (e.currentTarget as HTMLInputElement).value)}
                                placeholder="(same as entry)" />
                        </label>
                    </div>
                    <div class="row" style="gap:16px; flex-wrap:wrap;">
                        <label>
                            Load %
                            <input type="number" min={0} max={100} value={draft.Load}
                                onInput={(e) => updateField('Load', (e.currentTarget as HTMLInputElement).value)}
                                style="width:80px;" />
                        </label>
                        <label>
                            Status
                            <select value={draft.Status}
                                onChange={(e) => updateField('Status', (e.currentTarget as HTMLSelectElement).value)}>
                                <option value="1">Enabled</option>
                                <option value="0">Disabled</option>
                            </select>
                        </label>
                        <label>
                            Lat
                            <input value={draft.Lat}
                                onInput={(e) => updateField('Lat', (e.currentTarget as HTMLInputElement).value)}
                                style="width:100px;" />
                        </label>
                        <label>
                            Lon
                            <input value={draft.Lon}
                                onInput={(e) => updateField('Lon', (e.currentTarget as HTMLInputElement).value)}
                                style="width:100px;" />
                        </label>
                    </div>
                    <div style="margin-top:12px;">
                        <label style="display:block;">
                            Config blob — paste an OpenVPN .ovpn or WireGuard .conf file
                            <textarea value={draft.ConfigBlob}
                                onInput={(e) => updateConfigBlob((e.currentTarget as HTMLTextAreaElement).value)}
                                rows={10}
                                style="font-family: ui-monospace, monospace; font-size: 12px; width: 100%; margin-top: 6px;"
                                placeholder="client&#10;dev tun&#10;proto udp&#10;remote 1.2.3.4 1194&#10;..." />
                        </label>
                        <p class="dim" style="font-size: 12px; margin: 4px 0 0;">
                            Pasting auto-detects protocol + pre-fills Domain/EntryIP from
                            <code>remote &lt;host&gt;</code> (OpenVPN) or <code>Endpoint = &lt;host&gt;:&lt;port&gt;</code>
                            (WireGuard). Edit any field after paste; the blob is stored verbatim.
                        </p>
                    </div>
                    <div class="row" style="margin-top:16px; gap:8px;">
                        <button class="primary" onClick={save} disabled={busy}>
                            {creating ? 'Create' : 'Save'}
                        </button>
                        <button onClick={cancel} disabled={busy}>Cancel</button>
                    </div>
                </div>
            )}
        </>
    );
}

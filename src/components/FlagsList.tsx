import { useEffect, useState } from 'preact/hooks';
import { deleteFlag, listFlags, upsertFlag, type FeatureFlag } from '../api';
import { tsToHuman } from '../util';

const PAGE_SIZE = 100;

export function FlagsList() {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [scopeFilter, setScopeFilter] = useState('');
    const [nameFilter, setNameFilter] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        listFlags(page, PAGE_SIZE, scopeFilter, nameFilter)
            .then((r) => {
                if (cancelled) return;
                setFlags(r.Flags);
                setTotal(r.Total);
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            });
        return () => {
            cancelled = true;
        };
    }, [page, scopeFilter, nameFilter, tick]);

    const toggleEnabled = async (f: FeatureFlag) => {
        setBusy(true);
        setError(null);
        try {
            await upsertFlag({
                Scope: f.Scope,
                Name: f.Name,
                Enabled: !f.Enabled,
                Variant: f.Variant,
                ImpressionData: f.ImpressionData,
            });
            setTick((t) => t + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const del = async (f: FeatureFlag) => {
        if (!confirm(`Delete flag ${f.Scope}/${f.Name}?`)) return;
        setBusy(true);
        setError(null);
        try {
            await deleteFlag(f.ID);
            setTick((t) => t + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

    return (
        <>
            <h2>Feature flags</h2>
            <p class="dim" style="margin: 0 0 12px; font-size: 12px;">
                Read by <code>/feature/v2/frontend</code>. Scope <code>global</code> applies to
                everyone; <code>user:&lt;uuid&gt;</code> overrides global for that user. Unleash
                convention: <em>disabled</em> flags are filtered out of the SPA's response (the
                SPA's <code>useFlag()</code> falls back to false for missing names).
            </p>
            <div class="row">
                <input
                    type="search"
                    placeholder="filter by name"
                    value={nameFilter}
                    onInput={(e) => {
                        setNameFilter((e.currentTarget as HTMLInputElement).value);
                        setPage(0);
                    }}
                />
                <select
                    value={scopeFilter}
                    onChange={(e) => {
                        setScopeFilter((e.currentTarget as HTMLSelectElement).value);
                        setPage(0);
                    }}
                >
                    <option value="">all scopes</option>
                    <option value="global">global only</option>
                </select>
                <span class="dim">{total.toLocaleString()} flag{total === 1 ? '' : 's'}</span>
                <button style="margin-left:auto" onClick={() => setShowImport((v) => !v)}>
                    {showImport ? 'Hide import' : 'Import from JSON'}
                </button>
                <button class="primary" onClick={() => setShowNew((v) => !v)}>
                    {showNew ? 'Hide new-flag form' : '+ New flag'}
                </button>
            </div>
            {error !== null && <div class="error">{error}</div>}
            {showNew && <NewFlagForm onSaved={() => { setShowNew(false); setTick((t) => t + 1); }} />}
            {showImport && <ImportFromJsonForm onDone={() => { setShowImport(false); setTick((t) => t + 1); }} />}
            <table class="users" style="margin-top: 14px">
                <thead>
                    <tr>
                        <th>Scope</th>
                        <th>Name</th>
                        <th>Enabled</th>
                        <th>Variant</th>
                        <th>Updated</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {flags.map((f) => (
                        <tr key={f.ID}>
                            <td>
                                {f.Scope === 'global' ? (
                                    <span class="tag">global</span>
                                ) : (
                                    <code style="font-size: 11px">{f.Scope}</code>
                                )}
                            </td>
                            <td>
                                <code>{f.Name}</code>
                            </td>
                            <td>
                                <button
                                    onClick={() => toggleEnabled(f)}
                                    disabled={busy}
                                    style={`min-width: 70px; background: ${f.Enabled ? 'var(--ok)' : 'var(--bg-elev-2)'}; color: ${f.Enabled ? '#0b1018' : 'var(--text)'}; border-color: ${f.Enabled ? 'var(--ok)' : 'var(--border)'}; font-weight: 600;`}
                                >
                                    {f.Enabled ? 'ON' : 'OFF'}
                                </button>
                            </td>
                            <td>
                                <code style="font-size: 11px">
                                    {f.Variant?.name ?? '—'}
                                    {f.Variant?.enabled ? ' (active)' : ''}
                                </code>
                            </td>
                            <td>
                                <code style="font-size: 11px">{tsToHuman(f.UpdatedAt)}</code>
                            </td>
                            <td>
                                <button onClick={() => del(f)} disabled={busy} style="color: var(--danger)">
                                    delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    {flags.length === 0 && (
                        <tr>
                            <td colSpan={6} class="dim" style="text-align: center; padding: 30px">
                                no flags match — create one via the "+ New flag" button
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <div class="row" style="margin-top: 16px; justify-content: flex-end">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    ← prev
                </button>
                <span class="dim">page {page + 1} / {lastPage + 1}</span>
                <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
                    next →
                </button>
            </div>
        </>
    );
}

function NewFlagForm({ onSaved }: { onSaved: () => void }) {
    const [scopeKind, setScopeKind] = useState<'global' | 'user'>('global');
    const [userUuid, setUserUuid] = useState('');
    const [name, setName] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [variantName, setVariantName] = useState('disabled');
    const [variantEnabled, setVariantEnabled] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (scopeKind === 'user' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)) {
            setError('User scope requires a valid UUID');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await upsertFlag({
                Scope: scopeKind === 'global' ? 'global' : `user:${userUuid}`,
                Name: name.trim(),
                Enabled: enabled,
                Variant: {
                    name: variantName,
                    enabled: variantEnabled,
                    feature_enabled: true,
                },
            });
            setName('');
            setUserUuid('');
            onSaved();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div class="panel" style="border-color: var(--accent); margin-top: 12px">
            <h3>New / upsert flag</h3>
            <div class="kv">
                <div class="k">Scope</div>
                <div class="v">
                    <select
                        value={scopeKind}
                        onChange={(e) => setScopeKind((e.currentTarget as HTMLSelectElement).value as 'global' | 'user')}
                    >
                        <option value="global">global</option>
                        <option value="user">user (per-user override)</option>
                    </select>
                    {scopeKind === 'user' && (
                        <input
                            type="text"
                            placeholder="user UUID"
                            value={userUuid}
                            onInput={(e) => setUserUuid((e.currentTarget as HTMLInputElement).value)}
                            style="margin-left: 10px; max-width: 350px"
                        />
                    )}
                </div>
                <div class="k">Name</div>
                <div class="v">
                    <input
                        type="text"
                        placeholder="e.g. AccountSessions"
                        value={name}
                        onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
                    />
                </div>
                <div class="k">Enabled</div>
                <div class="v">
                    <label style="display: inline-flex; align-items: center; gap: 6px">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled((e.currentTarget as HTMLInputElement).checked)}
                        />
                        <span class="dim">disabled flags don't appear in the SPA toggles list</span>
                    </label>
                </div>
                <div class="k">Variant</div>
                <div class="v">
                    <input
                        type="text"
                        placeholder="variant name"
                        value={variantName}
                        onInput={(e) => setVariantName((e.currentTarget as HTMLInputElement).value)}
                        style="max-width: 180px"
                    />
                    <label style="margin-left: 10px; display: inline-flex; align-items: center; gap: 6px">
                        <input
                            type="checkbox"
                            checked={variantEnabled}
                            onChange={(e) => setVariantEnabled((e.currentTarget as HTMLInputElement).checked)}
                        />
                        <span class="dim">variant.enabled (for A/B branches)</span>
                    </label>
                </div>
            </div>
            {error !== null && <div class="error">{error}</div>}
            <div class="row" style="margin-top: 12px">
                <button class="primary" onClick={save} disabled={saving}>
                    {saving ? 'saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}

interface ImportRow {
    name: string;
    variant?: { name?: string; enabled?: boolean; feature_enabled?: boolean };
    impressionData?: boolean;
}

function parseImportJson(text: string): { rows: ImportRow[]; error: string | null } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return { rows: [], error: `JSON parse failed: ${(e as Error).message}` };
    }
    const candidates =
        Array.isArray(parsed) ? parsed
            : parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { toggles?: unknown }).toggles)
                ? (parsed as { toggles: unknown[] }).toggles
                : null;
    if (candidates === null) {
        return { rows: [], error: 'Expected an array of toggles or { "toggles": [ ... ] }' };
    }
    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    for (const raw of candidates) {
        if (raw === null || typeof raw !== 'object') continue;
        const r = raw as { name?: unknown; variant?: unknown; impressionData?: unknown };
        if (typeof r.name !== 'string' || r.name.trim() === '') continue;
        if (seen.has(r.name)) continue;
        seen.add(r.name);
        const variant =
            r.variant !== null && typeof r.variant === 'object'
                ? (r.variant as ImportRow['variant'])
                : undefined;
        rows.push({
            name: r.name,
            variant,
            impressionData: typeof r.impressionData === 'boolean' ? r.impressionData : undefined,
        });
    }
    if (rows.length === 0) return { rows, error: 'No toggle rows with a "name" field' };
    return { rows, error: null };
}

function ImportFromJsonForm({ onDone }: { onDone: () => void }) {
    const [text, setText] = useState('');
    const [parsed, setParsed] = useState<{ rows: ImportRow[]; error: string | null } | null>(null);
    const [skipExisting, setSkipExisting] = useState(true);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; failed: number; errors: string[] } | null>(null);

    const onParse = () => {
        setResult(null);
        setParsed(parseImportJson(text));
    };

    const onImport = async () => {
        if (parsed === null || parsed.error !== null) return;
        setImporting(true);
        setResult(null);

        let existingNames = new Set<string>();
        if (skipExisting) {
            try {
                const r = await listFlags(0, 1000, 'global', '');
                existingNames = new Set(r.Flags.map((f) => f.Name));
            } catch (e) {
                setImporting(false);
                setResult({ created: 0, skipped: 0, failed: 0, errors: [`list pre-check failed: ${(e as Error).message}`] });
                return;
            }
        }

        let created = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of parsed.rows) {
            if (skipExisting && existingNames.has(row.name)) {
                skipped++;
                continue;
            }
            try {
                await upsertFlag({
                    Scope: 'global',
                    Name: row.name,
                    Enabled: false,
                    Variant: row.variant ?? { name: 'disabled', enabled: false, feature_enabled: true },
                    ImpressionData: row.impressionData ?? false,
                });
                created++;
            } catch (e) {
                failed++;
                if (errors.length < 5) errors.push(`${row.name}: ${(e as Error).message}`);
            }
        }

        setImporting(false);
        setResult({ created, skipped, failed, errors });
        if (created > 0 && failed === 0) {
            setTimeout(onDone, 1500);
        }
    };

    return (
        <div class="panel" style="border-color: var(--accent); margin-top: 12px">
            <h3>Import flags from JSON</h3>
            <p class="dim" style="margin: 0 0 12px; font-size: 12px;">
                Paste Proton's <code>/feature/v2/frontend</code> response (an array, or{' '}
                <code>{'{toggles: [ ... ]}'}</code>). Each row's <code>name</code> is upserted as a
                <strong> global, disabled</strong> flag — operators flip individual rows on via the
                inline ON/OFF toggle. The <code>variant</code> + <code>impressionData</code> fields
                are preserved when present; otherwise the defaults from ADR 061 apply.
            </p>
            <textarea
                value={text}
                onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
                placeholder='[{"name":"AccountLockByOrganizationId","enabled":true,"variant":{...}}, ...]'
                style="width:100%; min-height:200px; background: var(--bg-elev); border: 1px solid var(--border); color: var(--text); padding: 10px; font-family: var(--mono); font-size: 12px;"
            />
            <div class="row" style="margin-top:10px; align-items:center; gap:14px">
                <button onClick={onParse} disabled={text.trim() === ''}>
                    Parse
                </button>
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer">
                    <input
                        type="checkbox"
                        checked={skipExisting}
                        onChange={(e) => setSkipExisting((e.currentTarget as HTMLInputElement).checked)}
                    />
                    <span class="dim">Skip names that already exist at <code>global</code> scope</span>
                </label>
            </div>
            {parsed !== null && parsed.error !== null && <div class="error">{parsed.error}</div>}
            {parsed !== null && parsed.error === null && (
                <div style="margin-top: 12px">
                    <p class="dim" style="margin: 0 0 8px; font-size: 12px;">
                        Parsed <strong>{parsed.rows.length}</strong> unique toggle{parsed.rows.length === 1 ? '' : 's'}.
                        Previewing first 10 names:
                    </p>
                    <code style="display:block; padding:8px; background:var(--bg-elev); font-size:11px; max-height:120px; overflow:auto;">
                        {parsed.rows.slice(0, 10).map((r) => r.name).join(', ')}
                        {parsed.rows.length > 10 ? `, … (+${parsed.rows.length - 10} more)` : ''}
                    </code>
                    <div class="row" style="margin-top:12px">
                        <button class="primary" onClick={onImport} disabled={importing}>
                            {importing ? `importing… (${parsed.rows.length} flags)` : `Import ${parsed.rows.length} flags as global, disabled`}
                        </button>
                    </div>
                </div>
            )}
            {result !== null && (
                <div style="margin-top:14px; padding:10px; border:1px solid var(--border); background:var(--bg-elev); font-size:13px;">
                    <strong>Created:</strong> {result.created}
                    {' · '}<strong>Skipped:</strong> {result.skipped}
                    {' · '}<strong>Failed:</strong> {result.failed}
                    {result.errors.length > 0 && (
                        <ul style="margin: 8px 0 0; padding-left: 20px; color: var(--danger); font-size: 12px;">
                            {result.errors.map((m, i) => (
                                <li key={i}><code>{m}</code></li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

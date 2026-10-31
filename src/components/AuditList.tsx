import { useEffect, useState } from 'preact/hooks';
import { listAudit, type AuditEntry } from '../api';
import { tsToHuman } from '../util';

const PAGE_SIZE = 50;

export function AuditList() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [actionFilter, setActionFilter] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        listAudit(page, PAGE_SIZE, actionFilter, '')
            .then((r) => {
                if (cancelled) return;
                setEntries(r.Entries);
                setTotal(r.Total);
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page, actionFilter]);

    const toggle = (id: string) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

    return (
        <>
            <h2>Audit log</h2>
            <div class="row">
                <input
                    type="search"
                    placeholder="filter by action (e.g. plan.update)"
                    value={actionFilter}
                    onInput={(e) => {
                        setActionFilter((e.currentTarget as HTMLInputElement).value);
                        setPage(0);
                    }}
                />
                <span class="dim">{loading ? 'loading…' : `${total.toLocaleString()} entries`}</span>
            </div>
            {error !== null && <div class="error">{error}</div>}
            <table class="users">
                <thead>
                    <tr>
                        <th>At (UTC)</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Actor</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e) => (
                        <>
                            <tr key={e.ID} class="clickable" onClick={() => toggle(e.ID)}>
                                <td>
                                    <code>{tsToHuman(e.At)}</code>
                                </td>
                                <td>
                                    <span class="tag">{e.Action}</span>
                                </td>
                                <td>{e.Target ? <code>{e.Target}</code> : <span class="dim">—</span>}</td>
                                <td>
                                    <code class="dim">{e.ActorHash.slice(0, 12)}…</code>
                                </td>
                                <td class="dim">{expanded.has(e.ID) ? '▼' : '▶'}</td>
                            </tr>
                            {expanded.has(e.ID) && (
                                <tr>
                                    <td colSpan={5} style="background: var(--bg-elev-2); padding: 12px 20px;">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                            <div>
                                                <div class="dim" style="margin-bottom: 4px; font-size: 11px;">before</div>
                                                <pre style="margin:0; padding:8px; background:var(--bg); border-radius:3px; font-family:var(--mono); font-size:11px; overflow:auto; max-height:300px;">{JSON.stringify(e.Before, null, 2)}</pre>
                                            </div>
                                            <div>
                                                <div class="dim" style="margin-bottom: 4px; font-size: 11px;">after</div>
                                                <pre style="margin:0; padding:8px; background:var(--bg); border-radius:3px; font-family:var(--mono); font-size:11px; overflow:auto; max-height:300px;">{JSON.stringify(e.After, null, 2)}</pre>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
            <div class="row" style="margin-top:16px; justify-content:flex-end">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    ← prev
                </button>
                <span class="dim">
                    page {page + 1} / {lastPage + 1}
                </span>
                <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
                    next →
                </button>
            </div>
        </>
    );
}

import { useEffect, useState } from 'preact/hooks';

import { listAudit, type AuditEntry } from '../api';
import { tsToHuman } from '../util';

// ADR 215 — per-user audit-log panel on the user detail page.
// ADR 190 noted this as a follow-up:
//   "Audit-log filter on the user detail panel to surface just the
//    VPN events for this user."
// This extends the scope to ALL audit actions targeting the user
// (user.update, subscription.update, vpn.credentials.upsert, etc.)
// rather than only VPN — operators usually want one place to see
// "what's happened to this user".
//
// Filter is server-side: listAudit(target=userId) joins on the
// /admin/v1/audit Target column. Page size kept small (15) so the
// user detail page stays scannable; "View full audit log" link
// jumps to the unscoped /audit view.

const PAGE_SIZE = 15;

interface Props {
    userId: string;
}

export function UserAuditPanel({ userId }: Props) {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        listAudit(page, PAGE_SIZE, '', userId)
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
    }, [userId, page]);

    const toggle = (id: string) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

    return (
        <div class="panel">
            <div class="row" style="justify-content: space-between; margin-bottom: 8px;">
                <h3 style="margin: 0;">Audit ({loading ? '…' : total.toLocaleString()})</h3>
                <a href="#/audit" class="dim" style="font-size: 12px;">View full log →</a>
            </div>
            <p class="dim" style="margin: 0 0 12px; font-size: 12px;">
                Every admin-mutation row whose Target = this user. Includes
                plan / subscription / VPN credentials / member-state changes
                and any future admin-side write targeting this row.
            </p>
            {error !== null && <div class="error">{error}</div>}
            {!loading && entries.length === 0 && (
                <p class="dim">No audit entries for this user yet.</p>
            )}
            {entries.length > 0 && (
                <table class="users">
                    <thead>
                        <tr>
                            <th>At (UTC)</th>
                            <th>Action</th>
                            <th>Actor</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e) => (
                            <>
                                <tr key={e.ID} class="clickable" onClick={() => toggle(e.ID)}>
                                    <td><code>{tsToHuman(e.At)}</code></td>
                                    <td><span class="tag">{e.Action}</span></td>
                                    <td><code class="dim">{e.ActorHash.slice(0, 12)}…</code></td>
                                    <td class="dim">{expanded.has(e.ID) ? '▼' : '▶'}</td>
                                </tr>
                                {expanded.has(e.ID) && (
                                    <tr>
                                        <td colSpan={4} style="background: var(--bg-elev-2); padding: 12px 20px;">
                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                                <div>
                                                    <div class="dim" style="margin-bottom: 4px; font-size: 11px;">before</div>
                                                    <pre style="margin:0; padding:8px; background:var(--bg); border-radius:3px; font-family:var(--mono); font-size:11px; overflow:auto; max-height:200px;">{JSON.stringify(e.Before, null, 2)}</pre>
                                                </div>
                                                <div>
                                                    <div class="dim" style="margin-bottom: 4px; font-size: 11px;">after</div>
                                                    <pre style="margin:0; padding:8px; background:var(--bg); border-radius:3px; font-family:var(--mono); font-size:11px; overflow:auto; max-height:200px;">{JSON.stringify(e.After, null, 2)}</pre>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            )}
            {lastPage > 0 && (
                <div class="row" style="margin-top: 12px; justify-content: flex-end; gap: 8px;">
                    <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                        ← prev
                    </button>
                    <span class="dim">page {page + 1} / {lastPage + 1}</span>
                    <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
                        next →
                    </button>
                </div>
            )}
        </div>
    );
}

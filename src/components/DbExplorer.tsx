import { useEffect, useState } from 'preact/hooks';
import { getDbTableRows, listDbTables, runDbQuery } from '../api';

export function DbTables({ onOpen }: { onOpen: (name: string) => void }) {
    const [tables, setTables] = useState<Array<{ Name: string; ApproxRows: number }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        listDbTables()
            .then((r) => {
                if (!cancelled) setTables(r.Tables);
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
    }, []);

    return (
        <>
            <h2>Database — tables</h2>
            <div class="row">
                <span class="dim">
                    {loading ? 'loading…' : `${tables.length} tables · use the SQL view for arbitrary queries`}
                </span>
                <a href="#/db/query" style="margin-left:auto">SQL query →</a>
            </div>
            {error !== null && <div class="error">{error}</div>}
            <table class="users">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Approx rows</th>
                    </tr>
                </thead>
                <tbody>
                    {tables.map((t) => (
                        <tr key={t.Name} class="clickable" onClick={() => onOpen(t.Name)}>
                            <td>
                                <code>{t.Name}</code>
                            </td>
                            <td>{t.ApproxRows.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

const TABLE_PAGE_SIZE = 50;

function renderCell(v: unknown): preact.ComponentChildren {
    if (v === null || v === undefined) return <span class="dim">null</span>;
    if (typeof v === 'object') return <code style="font-size:11px">{JSON.stringify(v).slice(0, 200)}</code>;
    const s = String(v);
    return s.length > 120 ? <span title={s}>{s.slice(0, 120)}…</span> : s;
}

export function DbTableRows({ name, onBack }: { name: string; onBack: () => void }) {
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<unknown[][]>([]);
    const [page, setPage] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDbTableRows(name, page, TABLE_PAGE_SIZE)
            .then((r) => {
                if (cancelled) return;
                setColumns(r.Columns);
                setRows(r.Rows);
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
    }, [name, page]);

    return (
        <>
            <div class="row">
                <button onClick={onBack}>← back</button>
                <h2 style="margin:0">
                    <code>{name}</code>
                </h2>
                {loading && <span class="dim">loading…</span>}
            </div>
            {error !== null && <div class="error">{error}</div>}
            <div style="overflow-x: auto">
                <table class="users">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c}>{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, ri) => (
                            <tr key={ri}>
                                {r.map((v, ci) => (
                                    <td key={ci}>{renderCell(v)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div class="row" style="margin-top:16px; justify-content:flex-end">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    ← prev
                </button>
                <span class="dim">page {page + 1}</span>
                <button
                    disabled={rows.length < TABLE_PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                >
                    next →
                </button>
            </div>
        </>
    );
}

export function DbQueryView() {
    const [query, setQuery] = useState('SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 50;');
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<unknown[][]>([]);
    const [rowCount, setRowCount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [dangerous, setDangerous] = useState(false);

    const run = async () => {
        if (dangerous) {
            const ok = window.confirm(
                'DANGEROUS MODE — read-only guard is dropped.\n\nThis query may INSERT / UPDATE / DELETE / DDL and the change is committed to admin_audit as db.query.dangerous.\n\nContinue?',
            );
            if (!ok) return;
        }
        setRunning(true);
        setError(null);
        try {
            const r = await runDbQuery(query, dangerous);
            setColumns(r.Columns);
            setRows(r.Rows);
            setRowCount(r.RowCount);
        } catch (e) {
            setError((e as Error).message);
            setColumns([]);
            setRows([]);
            setRowCount(null);
        } finally {
            setRunning(false);
        }
    };

    return (
        <>
            <h2>Database — SQL query</h2>
            <p class="dim" style="margin: 0 0 12px; font-size: 12px;">
                Wrapped in <code>SET TRANSACTION READ ONLY</code> +{' '}
                <code>SET LOCAL statement_timeout = '5s'</code>. Any write (INSERT / UPDATE / DELETE /
                DDL) raises an error and rolls back. Every query is audited to <code>admin_audit</code>.
            </p>
            <textarea
                value={query}
                onInput={(e) => setQuery((e.currentTarget as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void run();
                    }
                }}
                style={`width:100%; min-height:160px; background: var(--bg-elev); border: 1px solid ${dangerous ? '#c0392b' : 'var(--border)'}; color: var(--text); padding: 10px; font-family: var(--mono); font-size: 13px;`}
            />
            <div class="row" style="margin-top:10px; align-items:center; gap:12px">
                <button class={dangerous ? 'danger' : 'primary'} onClick={run} disabled={running}>
                    {running ? 'running…' : dangerous ? 'Run DANGEROUS (Ctrl/Cmd+Enter)' : 'Run (Ctrl/Cmd+Enter)'}
                </button>
                <label style="display:flex; align-items:center; gap:6px; font-size: 13px; cursor: pointer;">
                    <input
                        type="checkbox"
                        checked={dangerous}
                        onChange={(e) => setDangerous((e.currentTarget as HTMLInputElement).checked)}
                    />
                    <span style={dangerous ? 'color:#c0392b; font-weight:600' : undefined}>
                        Dangerous mode (writes allowed)
                    </span>
                </label>
                {rowCount !== null && (
                    <span class="tag ok">{rowCount} row{rowCount === 1 ? '' : 's'}</span>
                )}
            </div>
            {dangerous && (
                <div style="margin-top:10px; padding:8px 10px; border:1px solid #c0392b; background:rgba(192,57,43,0.08); color:#e57373; font-size:12px;">
                    Writes will commit. Use <code>BEGIN; … ROLLBACK;</code> to test a destructive query first.
                </div>
            )}
            {error !== null && <div class="error">{error}</div>}
            {columns.length > 0 && (
                <div style="overflow-x: auto; margin-top:16px">
                    <table class="users">
                        <thead>
                            <tr>
                                {columns.map((c) => (
                                    <th key={c}>{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, ri) => (
                                <tr key={ri}>
                                    {r.map((v, ci) => (
                                        <td key={ci}>{renderCell(v)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

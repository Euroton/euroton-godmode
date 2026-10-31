import { useEffect, useState } from 'preact/hooks';
import { listUsers, type UserListEntry } from '../api';

interface Props {
    onOpen: (id: string) => void;
}

const PAGE_SIZE = 25;

function bytesToHuman(n: number): string {
    if (n === 0) return '0';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function tsToHuman(ts: number): string {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 16);
}

export function UsersList({ onOpen }: Props) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rows, setRows] = useState<UserListEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        listUsers(search, page, PAGE_SIZE)
            .then((r) => {
                if (cancelled) return;
                setRows(r.Users);
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
    }, [search, page]);

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

    return (
        <>
            <h2>Users</h2>
            <div class="row">
                <input
                    type="search"
                    placeholder="search by username or email"
                    value={search}
                    onInput={(e) => {
                        setSearch((e.currentTarget as HTMLInputElement).value);
                        setPage(0);
                    }}
                />
                <span class="dim">
                    {loading ? 'loading…' : `${total.toLocaleString()} total`}
                </span>
            </div>
            {error !== null && <div class="error">{error}</div>}
            <table class="users">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Storage</th>
                        <th>Created</th>
                        <th>2FA</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((u) => (
                        <tr key={u.ID} class="clickable" onClick={() => onOpen(u.ID)}>
                            <td>
                                <strong>{u.DisplayName || u.Username}</strong>
                                {u.DisplayName && u.DisplayName !== u.Username && (
                                    <div class="dim" style="font-size: 0.85em;"><code>{u.Username}</code></div>
                                )}
                                <div>
                                    <code>{u.ID.slice(0, 12)}…</code>
                                </div>
                            </td>
                            <td>{u.Email || <span class="dim">—</span>}</td>
                            <td>
                                {u.PlanTitle ?? <span class="dim">—</span>}
                                {u.PlanID && u.PlanID !== 'free' && (
                                    <span class="tag ok" style="margin-left:6px">paid</span>
                                )}
                            </td>
                            <td>
                                {bytesToHuman(u.UsedSpace)}{' '}
                                <span class="dim">/ {bytesToHuman(u.MaxSpace)}</span>
                            </td>
                            <td>{tsToHuman(u.CreateTime)}</td>
                            <td>
                                {u.TwoFactor ? (
                                    <span class="tag ok">on</span>
                                ) : (
                                    <span class="tag">off</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {!loading && rows.length === 0 && error === null && (
                        <tr>
                            <td colSpan={6} class="dim" style="text-align:center;padding:30px">
                                no users matched
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <div class="row" style="margin-top:16px;justify-content:flex-end">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    ← prev
                </button>
                <span class="dim">
                    page {page + 1} / {lastPage + 1}
                </span>
                <button
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                >
                    next →
                </button>
            </div>
        </>
    );
}

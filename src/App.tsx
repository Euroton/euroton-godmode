import { useEffect, useState } from 'preact/hooks';
import { getBase, getToken, setBase, setToken } from './api';
import { UsersList } from './components/UsersList';
import { UserDetail } from './components/UserDetail';
import { PlansList } from './components/PlansList';
import { PlanEditor } from './components/PlanEditor';
import { AuditList } from './components/AuditList';
import { DbQueryView, DbTableRows, DbTables } from './components/DbExplorer';
import { FlagsList } from './components/FlagsList';
import { CouponsList } from './components/CouponsList';
import { VpnPanel } from './components/VpnPanel';

type View =
    | { kind: 'users' }
    | { kind: 'user'; id: string }
    | { kind: 'plans' }
    | { kind: 'plan'; id: string }
    | { kind: 'flags' }
    | { kind: 'coupons' }
    | { kind: 'vpn' }
    | { kind: 'audit' }
    | { kind: 'db' }
    | { kind: 'db-table'; name: string }
    | { kind: 'db-query' }
    | { kind: 'config' };

function readHash(): View {
    const h = window.location.hash.replace(/^#\/?/, '');
    if (h === '' || h === 'users') return { kind: 'users' };
    if (h === 'plans') return { kind: 'plans' };
    if (h === 'flags') return { kind: 'flags' };
    if (h === 'coupons') return { kind: 'coupons' };
    if (h === 'vpn') return { kind: 'vpn' };
    if (h === 'audit') return { kind: 'audit' };
    if (h === 'config') return { kind: 'config' };
    if (h === 'db') return { kind: 'db' };
    if (h === 'db/query') return { kind: 'db-query' };
    const userMatch = /^users\/(.+)$/.exec(h);
    if (userMatch) return { kind: 'user', id: decodeURIComponent(userMatch[1]!) };
    const planMatch = /^plans\/(.+)$/.exec(h);
    if (planMatch) return { kind: 'plan', id: decodeURIComponent(planMatch[1]!) };
    const tableMatch = /^db\/tables\/(.+)$/.exec(h);
    if (tableMatch) return { kind: 'db-table', name: decodeURIComponent(tableMatch[1]!) };
    return { kind: 'users' };
}

function viewToHash(v: View): string {
    switch (v.kind) {
        case 'users': return '#/users';
        case 'user': return `#/users/${encodeURIComponent(v.id)}`;
        case 'plans': return '#/plans';
        case 'plan': return `#/plans/${encodeURIComponent(v.id)}`;
        case 'flags': return '#/flags';
        case 'coupons': return '#/coupons';
        case 'vpn': return '#/vpn';
        case 'audit': return '#/audit';
        case 'db': return '#/db';
        case 'db-table': return `#/db/tables/${encodeURIComponent(v.name)}`;
        case 'db-query': return '#/db/query';
        case 'config': return '#/config';
    }
}

function writeHash(v: View): void {
    const target = viewToHash(v);
    if (window.location.hash !== target) window.location.hash = target;
}

export function App() {
    // First-run gate: if the operator hasn't set a token, force config view
    // regardless of URL hash. Otherwise UsersList et al fire a doomed fetch
    // before the operator has a chance to configure anything.
    const tokenSet = getToken().length > 0;
    const [view, setView] = useState<View>(() => (tokenSet ? readHash() : { kind: 'config' }));

    useEffect(() => {
        const onHash = () => setView(readHash());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const navigate = (v: View) => {
        writeHash(v);
        setView(v);
    };

    const NavLink = ({ to, label }: { to: View; label: string }) => (
        <a
            href={viewToHash(to)}
            onClick={(e) => {
                e.preventDefault();
                navigate(to);
            }}
            class={view.kind === to.kind || (to.kind === 'db' && view.kind === 'db-table') ? 'active' : ''}
            style={`margin-right: 14px; ${view.kind === to.kind ? 'color: var(--text); font-weight: 600;' : ''}`}
        >
            {label}
        </a>
    );

    return (
        <>
            <header class="topbar">
                <div style="display:flex; align-items:center; gap:20px">
                    <h1>
                        <a
                            href="#/users"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate({ kind: 'users' });
                            }}
                            style="color: inherit;"
                        >
                            godmode
                        </a>
                    </h1>
                    <nav style="font-size: 13px;">
                        <NavLink to={{ kind: 'users' }} label="Users" />
                        <NavLink to={{ kind: 'plans' }} label="Plans" />
                        <NavLink to={{ kind: 'flags' }} label="Flags" />
                        <NavLink to={{ kind: 'coupons' }} label="Coupons" />
                        <NavLink to={{ kind: 'vpn' }} label="VPN" />
                        <NavLink to={{ kind: 'audit' }} label="Audit" />
                        <NavLink to={{ kind: 'db' }} label="Database" />
                    </nav>
                </div>
                <span class="env">
                    <span class="dim">api: </span>
                    {getBase()}
                    {' · '}
                    <a
                        href="#/config"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate({ kind: 'config' });
                        }}
                    >
                        {tokenSet ? 'token set' : 'token missing'}
                    </a>
                </span>
            </header>
            <main>
                {view.kind === 'config' && <ConfigView onDone={() => navigate({ kind: 'users' })} />}
                {view.kind === 'users' && <UsersList onOpen={(id) => navigate({ kind: 'user', id })} />}
                {view.kind === 'user' && (
                    <UserDetail id={view.id} onBack={() => navigate({ kind: 'users' })} />
                )}
                {view.kind === 'plans' && <PlansList onOpen={(id) => navigate({ kind: 'plan', id })} />}
                {view.kind === 'plan' && (
                    <PlanEditor id={view.id} onBack={() => navigate({ kind: 'plans' })} />
                )}
                {view.kind === 'flags' && <FlagsList />}
                {view.kind === 'coupons' && <CouponsList />}
                {view.kind === 'vpn' && <VpnPanel />}
                {view.kind === 'audit' && <AuditList />}
                {view.kind === 'db' && <DbTables onOpen={(name) => navigate({ kind: 'db-table', name })} />}
                {view.kind === 'db-table' && (
                    <DbTableRows name={view.name} onBack={() => navigate({ kind: 'db' })} />
                )}
                {view.kind === 'db-query' && <DbQueryView />}
            </main>
        </>
    );
}

function ConfigView({ onDone }: { onDone: () => void }) {
    const [base, setBaseLocal] = useState(getBase());
    const [token, setTokenLocal] = useState(getToken());

    const save = () => {
        setBase(base.trim());
        setToken(token.trim());
        onDone();
    };

    return (
        <>
            <h2>Configuration</h2>
            <div class="panel">
                <h3>API base URL</h3>
                <input
                    type="text"
                    value={base}
                    onInput={(e) => setBaseLocal((e.currentTarget as HTMLInputElement).value)}
                    placeholder="http://localhost:4000"
                />
                <p class="dim" style="margin: 8px 0 0; font-size: 12px;">
                    The euroton-server origin. Typically <code>http://localhost:4000</code> in dev or the
                    preprod admin-bound URL in production. Pre-filled from the page hostname when served
                    from <code>godmode.*</code>.
                </p>
            </div>
            <div class="panel">
                <h3>Operator token</h3>
                <input
                    type="password"
                    value={token}
                    onInput={(e) => setTokenLocal((e.currentTarget as HTMLInputElement).value)}
                    placeholder="bearer token"
                />
                <p class="dim" style="margin: 8px 0 0; font-size: 12px;">
                    Matches <code>OPERATOR_TOKEN</code> on the server. Stored in localStorage; never sent
                    anywhere except as a Bearer header to <code>/admin/v1/*</code>.
                </p>
            </div>
            <div class="row">
                <button class="primary" onClick={save}>
                    Save
                </button>
            </div>
        </>
    );
}

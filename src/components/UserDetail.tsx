import { useEffect, useState } from 'preact/hooks';
import { getUser, type Subscription, type UserDetail as UserDetailShape } from '../api';
import { bytesToHuman, tsToHuman } from '../util';
import { SubscriptionEditor } from './SubscriptionEditor';
import { UserAuditPanel } from './UserAuditPanel';
import { VpnCredentialsEditor } from './VpnCredentialsEditor';

interface Props {
    id: string;
    onBack: () => void;
}

export function UserDetail({ id, onBack }: Props) {
    const [user, setUser] = useState<UserDetailShape | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getUser(id)
            .then((r) => {
                if (!cancelled) setUser(r.User);
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
    }, [id]);

    return (
        <>
            <div class="row">
                <button onClick={onBack}>← back</button>
                {loading && <span class="dim">loading…</span>}
            </div>
            {error !== null && <div class="error">{error}</div>}
            {user !== null && (
                <>
                    <h2>
                        {user.DisplayName}
                        {user.DisplayName !== user.Username && (
                            <span class="dim" style="font-weight: 400; margin-left: 8px; font-size: 0.7em;">
                                ({user.Username})
                            </span>
                        )}
                    </h2>
                    <div class="kv">
                        <div class="k">ID</div>
                        <div class="v">{user.ID}</div>
                        <div class="k">Username</div>
                        <div class="v"><code>{user.Username}</code></div>
                        <div class="k">Display name</div>
                        <div class="v">{user.DisplayName || <span class="dim">—</span>}</div>
                        <div class="k">Primary email</div>
                        <div class="v">{user.Email || <span class="dim">—</span>}</div>
                        <div class="k">Created</div>
                        <div class="v">{tsToHuman(user.CreateTime)}</div>
                        <div class="k">Storage</div>
                        <div class="v">
                            {bytesToHuman(user.UsedSpace)} / {bytesToHuman(user.MaxSpace)}
                        </div>
                        <div class="k">2FA</div>
                        <div class="v">
                            {user.TwoFactor ? (
                                <span class="tag ok">enabled</span>
                            ) : (
                                <span class="tag">disabled</span>
                            )}
                        </div>
                    </div>

                    <div class="panel">
                        <h3>Subscription</h3>
                        {user.Subscription !== null ? (
                            <div class="kv">
                                <div class="k">Plan</div>
                                <div class="v">
                                    {user.Subscription.PlanTitle}{' '}
                                    <span class="dim">({user.Subscription.PlanID})</span>
                                </div>
                                <div class="k">Cycle</div>
                                <div class="v">{user.Subscription.Cycle} month(s)</div>
                                <div class="k">Period end</div>
                                <div class="v">{tsToHuman(user.Subscription.PeriodEnd)}</div>
                            </div>
                        ) : (
                            <p class="dim">No subscription row.</p>
                        )}
                    </div>
                    <SubscriptionEditor
                        userId={user.ID}
                        current={
                            user.Subscription === null
                                ? null
                                : ({
                                      PlanID: user.Subscription.PlanID,
                                      Cycle: user.Subscription.Cycle,
                                      PeriodStart: 0,
                                      PeriodEnd: user.Subscription.PeriodEnd,
                                      RenewDisabled: false,
                                  } satisfies Subscription)
                        }
                        onChanged={(s) =>
                            setUser({
                                ...user,
                                Subscription: {
                                    PlanID: s.PlanID,
                                    PlanTitle: user.Subscription?.PlanTitle ?? s.PlanID,
                                    Cycle: s.Cycle,
                                    PeriodEnd: s.PeriodEnd,
                                },
                            })
                        }
                    />

                    <div class="panel">
                        <h3>Addresses ({user.Addresses.length})</h3>
                        {user.Addresses.length === 0 ? (
                            <p class="dim">No addresses provisioned.</p>
                        ) : (
                            <ul style="margin:0;padding-left:18px">
                                {user.Addresses.map((a) => (
                                    <li key={a.ID}>
                                        <code>{a.Email}</code>{' '}
                                        <span class="dim">{a.ID.slice(0, 8)}…</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div class="panel">
                        <h3>Sessions ({user.Sessions.length})</h3>
                        {user.Sessions.length === 0 ? (
                            <p class="dim">No sessions.</p>
                        ) : (
                            <table class="users">
                                <thead>
                                    <tr>
                                        <th>UID</th>
                                        <th>Created</th>
                                        <th>Refreshed</th>
                                        <th>Expires</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {user.Sessions.map((s) => (
                                        <tr key={s.UID}>
                                            <td>
                                                <code>{s.UID.slice(0, 16)}…</code>
                                            </td>
                                            <td>{tsToHuman(s.CreatedAt)}</td>
                                            <td>{tsToHuman(s.RefreshedAt)}</td>
                                            <td>{tsToHuman(s.ExpiresAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div class="panel">
                        <h3>Keys ({user.Keys.length})</h3>
                        {user.Keys.length === 0 ? (
                            <p class="dim">No user-level keys (account-key setup not complete).</p>
                        ) : (
                            <table class="users">
                                <thead>
                                    <tr>
                                        <th>Fingerprint</th>
                                        <th>Primary</th>
                                        <th>Activated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {user.Keys.map((k) => (
                                        <tr key={k.ID}>
                                            <td>
                                                <code>{k.Fingerprint}</code>
                                            </td>
                                            <td>
                                                {k.Primary ? (
                                                    <span class="tag ok">yes</span>
                                                ) : (
                                                    <span class="tag">no</span>
                                                )}
                                            </td>
                                            <td>
                                                {k.Activated ? (
                                                    <span class="tag ok">yes</span>
                                                ) : (
                                                    <span class="tag warn">no</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <VpnCredentialsEditor userId={user.ID} />

                    <UserAuditPanel userId={user.ID} />
                </>
            )}
        </>
    );
}

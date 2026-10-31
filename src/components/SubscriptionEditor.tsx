import { useEffect, useState } from 'preact/hooks';
import { listPlans, updateSubscription, type Plan, type Subscription } from '../api';
import { tsToHuman } from '../util';

interface Props {
    userId: string;
    current: Subscription | null;
    onChanged: (next: Subscription) => void;
}

export function SubscriptionEditor({ userId, current, onChanged }: Props) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [planId, setPlanId] = useState(current?.PlanID ?? 'free');
    const [lifetime, setLifetime] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        listPlans()
            .then((r) => {
                if (!cancelled) setPlans(r.Plans);
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setPlanId(current?.PlanID ?? 'free');
        setLifetime(false);
    }, [current?.PlanID]);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const r = await updateSubscription(userId, {
                PlanID: planId,
                Lifetime: lifetime || undefined,
            });
            onChanged(r.Subscription);
            setLifetime(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const noop = current?.PlanID === planId && !lifetime;

    return (
        <div class="panel" style="border-color: var(--accent)">
            <h3>Override subscription</h3>
            <div class="kv">
                <div class="k">Current</div>
                <div class="v">
                    {current === null ? (
                        <span class="dim">no subscription row (effectively Free)</span>
                    ) : (
                        <>
                            <code>{current.PlanID}</code>{' '}
                            <span class="dim">
                                · cycle {current.Cycle}m · period ends {tsToHuman(current.PeriodEnd)}
                            </span>
                            {current.RenewDisabled && <span class="tag" style="margin-left:6px">renew off</span>}
                        </>
                    )}
                </div>
                <div class="k">New plan</div>
                <div class="v">
                    <select
                        value={planId}
                        onChange={(e) => setPlanId((e.currentTarget as HTMLSelectElement).value)}
                    >
                        {plans.map((p) => (
                            <option key={p.ID} value={p.ID}>
                                {p.Title} ({p.ID})
                            </option>
                        ))}
                    </select>
                </div>
                <div class="k">Lifetime</div>
                <div class="v">
                    <label style="display:inline-flex; align-items:center; gap:6px">
                        <input
                            type="checkbox"
                            checked={lifetime}
                            onChange={(e) => setLifetime((e.currentTarget as HTMLInputElement).checked)}
                        />
                        <span>Set PeriodEnd to 2099-01-01 and disable renew</span>
                    </label>
                </div>
            </div>
            {error !== null && <div class="error">{error}</div>}
            <div class="row" style="margin-top:14px">
                <button class="primary" onClick={save} disabled={saving || noop}>
                    {saving ? 'saving…' : noop ? 'No change' : lifetime ? `Grant ${planId} for life` : `Set to ${planId}`}
                </button>
            </div>
        </div>
    );
}

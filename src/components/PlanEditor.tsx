import { useEffect, useState } from 'preact/hooks';
import { getPlan, updatePlan, type Plan } from '../api';
import { AddonsPanel } from './AddonsPanel';

interface Props {
    id: string;
    onBack: () => void;
}

export function PlanEditor({ id, onBack }: Props) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [draft, setDraft] = useState<Plan | null>(null);
    const [pricingText, setPricingText] = useState('');
    const [pricingError, setPricingError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        getPlan(id)
            .then((r) => {
                if (cancelled) return;
                setPlan(r.Plan);
                setDraft(r.Plan);
                setPricingText(JSON.stringify(r.Plan.Pricing, null, 2));
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            });
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (error !== null && plan === null) {
        return (
            <>
                <div class="row">
                    <button onClick={onBack}>← back</button>
                </div>
                <div class="error">{error}</div>
            </>
        );
    }

    if (draft === null || plan === null) {
        return (
            <div class="row">
                <button onClick={onBack}>← back</button>
                <span class="dim">loading…</span>
            </div>
        );
    }

    const setField = <K extends keyof Plan>(k: K, v: Plan[K]) => {
        setDraft({ ...draft, [k]: v });
    };

    const save = async () => {
        let pricing: Record<string, number> | undefined;
        if (pricingText.trim() !== JSON.stringify(plan.Pricing).trim()) {
            try {
                pricing = JSON.parse(pricingText);
                setPricingError(null);
            } catch (e) {
                setPricingError(`invalid JSON: ${(e as Error).message}`);
                return;
            }
        }

        setSaving(true);
        setError(null);
        // Only send changed fields to keep audit before/after diffs tight.
        const patch: Partial<Plan> = {};
        for (const k of Object.keys(draft) as Array<keyof Plan>) {
            if (k === 'ID' || k === 'Pricing') continue;
            if (draft[k] !== plan[k]) (patch as Record<string, unknown>)[k] = draft[k];
        }
        if (pricing !== undefined) patch.Pricing = pricing;

        try {
            const r = await updatePlan(id, patch);
            setPlan(r.Plan);
            setDraft(r.Plan);
            setPricingText(JSON.stringify(r.Plan.Pricing, null, 2));
            setSavedAt(Date.now());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const numInput = (k: keyof Plan, label: string, hint?: string) => (
        <>
            <div class="k">{label}</div>
            <div class="v">
                <input
                    type="number"
                    value={String(draft[k])}
                    onInput={(e) => setField(k, Number((e.currentTarget as HTMLInputElement).value) as Plan[typeof k])}
                />
                {hint !== undefined && <div class="dim" style="font-size:11px;margin-top:2px">{hint}</div>}
            </div>
        </>
    );

    const strInput = (k: keyof Plan, label: string) => (
        <>
            <div class="k">{label}</div>
            <div class="v">
                <input
                    type="text"
                    value={String(draft[k])}
                    onInput={(e) => setField(k, (e.currentTarget as HTMLInputElement).value as Plan[typeof k])}
                />
            </div>
        </>
    );

    return (
        <>
            <div class="row">
                <button onClick={onBack}>← back</button>
                {savedAt !== null && (
                    <span class="tag ok">saved {new Date(savedAt).toLocaleTimeString()}</span>
                )}
            </div>
            <h2>
                Edit plan <code>{plan.ID}</code>
            </h2>
            {error !== null && <div class="error">{error}</div>}

            <div class="panel">
                <h3>Identity</h3>
                <div class="kv">
                    <div class="k">ID</div>
                    <div class="v">
                        <code>{plan.ID}</code> <span class="dim">(immutable)</span>
                    </div>
                    {strInput('Name', 'Name (SPA enum key)')}
                    {strInput('Title', 'Title (display)')}
                </div>
            </div>

            <div class="panel">
                <h3>Posture</h3>
                <div class="kv">
                    {numInput('Type', 'Type', '1 = subscription, 0 = addon, 2 = lifetime / one-shot')}
                    {numInput('Services', 'Services bitmask', '1=Mail · 2=Calendar · 4=Drive · 8=VPN · 16=Pass · 31=all')}
                    {numInput('State', 'State', '1 = visible, 0 = hidden')}
                    {numInput('Features', 'Features bitmask')}
                    {numInput('Quantity', 'Quantity')}
                    {numInput('MaxTier', 'MaxTier', '0 = basic · 2 = premium (SPA grouping)')}
                    {strInput('ParentMetaPlanID', 'ParentMetaPlanID (groups plans into one tab)')}
                </div>
            </div>

            <div class="panel">
                <h3>Caps</h3>
                <div class="kv">
                    {numInput('MaxSpace', 'MaxSpace (bytes)', `currently ≈ ${(draft.MaxSpace / 1024 ** 3).toFixed(2)} GiB`)}
                    {numInput('MaxAddresses', 'MaxAddresses')}
                    {numInput('MaxCalendars', 'MaxCalendars')}
                    {numInput('MaxMembers', 'MaxMembers')}
                    {numInput('MaxDomains', 'MaxDomains')}
                    {numInput('MaxVPN', 'MaxVPN')}
                </div>
            </div>

            <div class="panel">
                <h3>Pricing</h3>
                <div class="kv">
                    {strInput('Currency', 'Currency')}
                    {numInput('Amount', 'Amount (cents, default cycle)')}
                    {numInput('Cycle', 'Cycle (months)')}
                </div>
                <p class="dim" style="margin: 16px 0 6px; font-size: 12px;">
                    Pricing JSON — `{'{'}` cycle in months: amount in cents `{'}'}`. Example:{' '}
                    <code>{'{"1": 499, "12": 4788, "24": 8376}'}</code>
                </p>
                <textarea
                    value={pricingText}
                    onInput={(e) => setPricingText((e.currentTarget as HTMLTextAreaElement).value)}
                    style="width:100%; min-height:120px; background: var(--bg-elev); border: 1px solid var(--border); color: var(--text); padding: 8px; font-family: var(--mono); font-size: 12px;"
                />
                {pricingError !== null && <div class="error">{pricingError}</div>}
            </div>

            <div class="row">
                <button class="primary" onClick={save} disabled={saving}>
                    {saving ? 'saving…' : 'Save changes'}
                </button>
                <button
                    onClick={() => {
                        setDraft(plan);
                        setPricingText(JSON.stringify(plan.Pricing, null, 2));
                        setPricingError(null);
                    }}
                    disabled={saving}
                >
                    Revert
                </button>
            </div>

            <AddonsPanel baseId={id} />
        </>
    );
}

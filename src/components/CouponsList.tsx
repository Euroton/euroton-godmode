import { useEffect, useState } from 'preact/hooks';

import {
    createCoupon,
    deleteCoupon,
    listCoupons,
    updateCoupon,
    type CouponInput,
    type CouponRow,
} from '../api';

interface DraftState {
    Code: string;
    Description: string;
    DiscountType: 'percent' | 'fixed' | 'none';
    DiscountValue: string;
    ApplicablePlans: string;
    MaxRedemptionsPerUser: string;
    ValidUntil: string;
}

const emptyDraft: DraftState = {
    Code: '',
    Description: '',
    DiscountType: 'percent',
    DiscountValue: '',
    ApplicablePlans: '',
    MaxRedemptionsPerUser: '',
    ValidUntil: '',
};

function rowToDraft(r: CouponRow): DraftState {
    return {
        Code: r.Code,
        Description: r.Description,
        DiscountType: r.DiscountPercent !== null
            ? 'percent'
            : r.DiscountFixedAmount !== null
                ? 'fixed'
                : 'none',
        DiscountValue: String(r.DiscountPercent ?? r.DiscountFixedAmount ?? ''),
        ApplicablePlans: (r.ApplicablePlans ?? []).join(', '),
        MaxRedemptionsPerUser: r.MaxRedemptionsPerUser !== null ? String(r.MaxRedemptionsPerUser) : '',
        ValidUntil: r.ValidUntil ? r.ValidUntil.slice(0, 10) : '',
    };
}

function draftToPayload(d: DraftState, isCreate: boolean): CouponInput {
    const payload: CouponInput = {
        Description: d.Description,
    };
    if (isCreate) payload.Code = d.Code.trim().toUpperCase();
    if (d.DiscountType === 'percent') {
        payload.DiscountPercent = d.DiscountValue ? Number(d.DiscountValue) : null;
        payload.DiscountFixedAmount = null;
    } else if (d.DiscountType === 'fixed') {
        payload.DiscountFixedAmount = d.DiscountValue ? Number(d.DiscountValue) : null;
        payload.DiscountPercent = null;
    } else {
        payload.DiscountPercent = null;
        payload.DiscountFixedAmount = null;
    }
    payload.ApplicablePlans = d.ApplicablePlans.trim()
        ? d.ApplicablePlans.split(',').map((s) => s.trim()).filter(Boolean)
        : null;
    payload.MaxRedemptionsPerUser = d.MaxRedemptionsPerUser
        ? Number(d.MaxRedemptionsPerUser)
        : null;
    payload.ValidUntil = d.ValidUntil ? new Date(d.ValidUntil).toISOString() : null;
    return payload;
}

function discountLabel(r: CouponRow): string {
    if (r.DiscountPercent !== null) return `${r.DiscountPercent}% off`;
    if (r.DiscountFixedAmount !== null) {
        return `${(r.DiscountFixedAmount / 100).toFixed(2)} off (fixed)`;
    }
    return '(no discount set)';
}

function statusLabel(r: CouponRow): { text: string; tone: 'good' | 'warn' | 'bad' } {
    if (r.ValidUntil) {
        const d = new Date(r.ValidUntil);
        if (d.getTime() <= Date.now()) return { text: 'expired', tone: 'bad' };
        return { text: `expires ${r.ValidUntil.slice(0, 10)}`, tone: 'warn' };
    }
    return { text: 'no expiry', tone: 'good' };
}

export function CouponsList() {
    const [rows, setRows] = useState<CouponRow[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Mode: idle | create-new | edit-existing
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState<DraftState>(emptyDraft);
    const [submitting, setSubmitting] = useState(false);

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await listCoupons();
            setRows(res.Coupons);
            setErr(null);
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const startCreate = () => {
        setEditing(null);
        setDraft(emptyDraft);
        setCreating(true);
    };

    const startEdit = (r: CouponRow) => {
        setCreating(false);
        setDraft(rowToDraft(r));
        setEditing(r.Code);
    };

    const cancel = () => {
        setCreating(false);
        setEditing(null);
        setDraft(emptyDraft);
        setErr(null);
    };

    const submit = async () => {
        setSubmitting(true);
        setErr(null);
        try {
            if (creating) {
                if (!draft.Code.trim()) throw new Error('Code is required');
                await createCoupon(draftToPayload(draft, true));
            } else if (editing) {
                await updateCoupon(editing, draftToPayload(draft, false));
            }
            cancel();
            await refresh();
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    const remove = async (code: string) => {
        const ok = window.confirm(
            `Delete coupon ${code}?\n\nThis removes the code and detaches it from any subscription that referenced it. coupon_redemptions rows for this code are also dropped.`,
        );
        if (!ok) return;
        try {
            await deleteCoupon(code);
            await refresh();
        } catch (e) {
            setErr((e as Error).message);
        }
    };

    return (
        <>
            <h2>Coupons</h2>
            <div class="row" style="margin-bottom: 16px;">
                <button class="primary" onClick={startCreate} disabled={creating}>
                    + New coupon
                </button>
                <button onClick={() => void refresh()} disabled={loading}>
                    Refresh
                </button>
            </div>

            {err && (
                <div class="panel" style="border-color: #c0392b; color: #ff8b80;">
                    {err}
                </div>
            )}

            {(creating || editing) && (
                <div class="panel">
                    <h3>{creating ? 'New coupon' : `Edit ${editing}`}</h3>
                    <div class="row" style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
                        {creating && (
                            <>
                                <label>Code</label>
                                <input
                                    type="text"
                                    value={draft.Code}
                                    placeholder="EUROTON25"
                                    onInput={(e) => setDraft({ ...draft, Code: (e.currentTarget as HTMLInputElement).value })}
                                />
                            </>
                        )}
                        <label>Description</label>
                        <input
                            type="text"
                            value={draft.Description}
                            placeholder="25% off Visionary annual"
                            onInput={(e) => setDraft({ ...draft, Description: (e.currentTarget as HTMLInputElement).value })}
                        />
                        <label>Discount type</label>
                        <select
                            value={draft.DiscountType}
                            onChange={(e) => setDraft({
                                ...draft,
                                DiscountType: (e.currentTarget as HTMLSelectElement).value as DraftState['DiscountType'],
                            })}
                        >
                            <option value="percent">Percent (1-100)</option>
                            <option value="fixed">Fixed (cents)</option>
                            <option value="none">None (placeholder)</option>
                        </select>
                        <label>Discount value</label>
                        <input
                            type="number"
                            value={draft.DiscountValue}
                            disabled={draft.DiscountType === 'none'}
                            placeholder={draft.DiscountType === 'percent' ? '25' : '500'}
                            onInput={(e) => setDraft({ ...draft, DiscountValue: (e.currentTarget as HTMLInputElement).value })}
                        />
                        <label>Applicable plans</label>
                        <input
                            type="text"
                            value={draft.ApplicablePlans}
                            placeholder="visionary2022, mailpro2022 (blank = any)"
                            onInput={(e) => setDraft({ ...draft, ApplicablePlans: (e.currentTarget as HTMLInputElement).value })}
                        />
                        <label>Max per user</label>
                        <input
                            type="number"
                            value={draft.MaxRedemptionsPerUser}
                            placeholder="1 (blank = unlimited)"
                            onInput={(e) => setDraft({ ...draft, MaxRedemptionsPerUser: (e.currentTarget as HTMLInputElement).value })}
                        />
                        <label>Valid until</label>
                        <input
                            type="date"
                            value={draft.ValidUntil}
                            onInput={(e) => setDraft({ ...draft, ValidUntil: (e.currentTarget as HTMLInputElement).value })}
                        />
                    </div>
                    <div class="row" style="margin-top: 14px;">
                        <button class="primary" onClick={() => void submit()} disabled={submitting}>
                            {submitting ? 'Saving...' : creating ? 'Create' : 'Save'}
                        </button>
                        <button onClick={cancel} disabled={submitting}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading && rows.length === 0 && <p class="dim">Loading...</p>}
            {!loading && rows.length === 0 && !creating && (
                <p class="dim">No coupons yet. Click "+ New coupon" to mint one.</p>
            )}

            {rows.length > 0 && (
                <table class="data">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Discount</th>
                            <th>Applicable plans</th>
                            <th>Max/user</th>
                            <th>Status</th>
                            <th>Redemptions</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const s = statusLabel(r);
                            return (
                                <tr key={r.Code}>
                                    <td><code>{r.Code}</code></td>
                                    <td>{r.Description || <span class="dim">(none)</span>}</td>
                                    <td>{discountLabel(r)}</td>
                                    <td>
                                        {(r.ApplicablePlans && r.ApplicablePlans.length > 0)
                                            ? r.ApplicablePlans.join(', ')
                                            : <span class="dim">any</span>}
                                    </td>
                                    <td>{r.MaxRedemptionsPerUser ?? <span class="dim">∞</span>}</td>
                                    <td>
                                        <span style={`color: ${s.tone === 'good' ? '#9ad' : s.tone === 'warn' ? '#dca85a' : '#e57373'};`}>
                                            {s.text}
                                        </span>
                                    </td>
                                    <td>{r.Redemptions ?? 0}</td>
                                    <td>
                                        <button onClick={() => startEdit(r)} disabled={creating || editing === r.Code}>
                                            Edit
                                        </button>{' '}
                                        <button class="danger" onClick={() => void remove(r.Code)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </>
    );
}

import { useEffect, useState } from 'preact/hooks';
import { listPlanAddons, updateAddonMaxQuantity, type PlanAddon } from '../api';

interface Props {
    baseId: string;
}

interface RowState {
    serverValue: number | null;
    draft: string;
    saving: boolean;
    error: string | null;
}

const ADDON_KIND = /^1(member|domain|ip|lumo|meet|scribe)-/;

function kindOf(name: string): string {
    const m = ADDON_KIND.exec(name);
    return m ? m[1]! : 'addon';
}

function priceLabel(addon: PlanAddon): string {
    const c = addon.Currency || 'EUR';
    const amount = (addon.Amount / 100).toFixed(2);
    return `${amount} ${c} / ${addon.Cycle}mo`;
}

export function AddonsPanel({ baseId }: Props) {
    const [addons, setAddons] = useState<PlanAddon[] | null>(null);
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        listPlanAddons(baseId)
            .then((r) => {
                if (cancelled) return;
                setAddons(r.Addons);
                const next: Record<string, RowState> = {};
                for (const a of r.Addons) {
                    next[a.ID] = {
                        serverValue: a.MaxQuantity,
                        draft: a.MaxQuantity === null ? '' : String(a.MaxQuantity),
                        saving: false,
                        error: null,
                    };
                }
                setRows(next);
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            });
        return () => {
            cancelled = true;
        };
    }, [baseId]);

    if (error !== null) {
        return (
            <div class="panel">
                <h3>Addons</h3>
                <div class="error">{error}</div>
            </div>
        );
    }
    if (addons === null) {
        return (
            <div class="panel">
                <h3>Addons</h3>
                <div class="dim">loading…</div>
            </div>
        );
    }
    if (addons.length === 0) {
        return (
            <div class="panel">
                <h3>Addons</h3>
                <p class="dim" style="font-size:12px;margin:0">
                    No addons linked to this plan. (Type=0 addon rows are
                    seeded for the B2B base plans only; see ADR 062.)
                </p>
            </div>
        );
    }

    const setDraft = (id: string, draft: string) => {
        setRows((prev) => ({ ...prev, [id]: { ...prev[id]!, draft } }));
    };

    const saveRow = async (addon: PlanAddon) => {
        const row = rows[addon.ID]!;
        const parsed = row.draft.trim() === '' ? null : Number(row.draft);
        if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
            setRows((prev) => ({
                ...prev,
                [addon.ID]: { ...prev[addon.ID]!, error: 'must be a non-negative integer or blank' },
            }));
            return;
        }
        setRows((prev) => ({
            ...prev,
            [addon.ID]: { ...prev[addon.ID]!, saving: true, error: null },
        }));
        try {
            const r = await updateAddonMaxQuantity(baseId, addon.ID, parsed);
            setRows((prev) => ({
                ...prev,
                [addon.ID]: {
                    serverValue: r.MaxQuantity,
                    draft: r.MaxQuantity === null ? '' : String(r.MaxQuantity),
                    saving: false,
                    error: null,
                },
            }));
        } catch (e) {
            setRows((prev) => ({
                ...prev,
                [addon.ID]: { ...prev[addon.ID]!, saving: false, error: (e as Error).message },
            }));
        }
    };

    return (
        <div class="panel">
            <h3>Addons</h3>
            <p class="dim" style="font-size:12px;margin:0 0 12px">
                Per-(base, addon) cap. Blank means no override — the base plan's
                Max&lt;Kind&gt; field caps it at checkout.
            </p>
            <div class="kv" style="grid-template-columns: max-content max-content 1fr max-content max-content;">
                <div class="k dim">Kind</div>
                <div class="k dim">Addon</div>
                <div class="k dim">Pricing</div>
                <div class="k dim">MaxQuantity</div>
                <div class="k dim"></div>
                {addons.map((a) => {
                    const row = rows[a.ID]!;
                    const dirty = row.draft !== (row.serverValue === null ? '' : String(row.serverValue));
                    return (
                        <>
                            <div class="v"><span class="tag">{kindOf(a.Name)}</span></div>
                            <div class="v" style="font-family: var(--mono); font-size: 12px;">
                                <div>{a.Title}</div>
                                <div class="dim">{a.Name}</div>
                            </div>
                            <div class="v dim" style="font-size: 12px;">{priceLabel(a)}</div>
                            <div class="v">
                                <input
                                    type="text"
                                    value={row.draft}
                                    placeholder="(blank)"
                                    onInput={(e) => setDraft(a.ID, (e.currentTarget as HTMLInputElement).value)}
                                    style="width: 70px;"
                                />
                                {row.error !== null && (
                                    <div class="error" style="font-size:11px;margin-top:2px">{row.error}</div>
                                )}
                            </div>
                            <div class="v">
                                <button
                                    onClick={() => saveRow(a)}
                                    disabled={row.saving || !dirty}
                                >
                                    {row.saving ? '…' : 'Save'}
                                </button>
                            </div>
                        </>
                    );
                })}
            </div>
        </div>
    );
}

import { useEffect, useState } from 'preact/hooks';
import { listPlans, type Plan } from '../api';
import { bytesToHuman } from '../util';

interface Props {
    onOpen: (id: string) => void;
}

export function PlansList({ onOpen }: Props) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        listPlans()
            .then((r) => {
                if (!cancelled) setPlans(r.Plans);
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
            <h2>Plans</h2>
            {loading && <p class="dim">loading…</p>}
            {error !== null && <div class="error">{error}</div>}
            {!loading && (
                <table class="users">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Title</th>
                            <th>Currency</th>
                            <th>MaxSpace</th>
                            <th>Pricing</th>
                            <th>State</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {plans.map((p) => (
                            <tr key={p.ID} class="clickable" onClick={() => onOpen(p.ID)}>
                                <td>
                                    <code>{p.ID}</code>
                                </td>
                                <td>
                                    <code>{p.Name}</code>
                                </td>
                                <td>{p.Title}</td>
                                <td>{p.Currency}</td>
                                <td>{bytesToHuman(p.MaxSpace)}</td>
                                <td>
                                    {Object.entries(p.Pricing)
                                        .map(([cycle, cents]) => `${cycle}m: ${(cents / 100).toFixed(2)}`)
                                        .join('  ·  ') || <span class="dim">—</span>}
                                </td>
                                <td>
                                    {p.State === 1 ? (
                                        <span class="tag ok">visible</span>
                                    ) : (
                                        <span class="tag">hidden</span>
                                    )}
                                </td>
                                <td>
                                    <a href={`#/plans/${p.ID}`} onClick={(e) => e.stopPropagation()}>edit →</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}

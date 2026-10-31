export function bytesToHuman(n: number): string {
    if (n === 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}

export function tsToHuman(ts: number | null): string {
    if (!ts) return '—';
    return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

export function dateInputToTs(s: string): number {
    // Date input is YYYY-MM-DD in local TZ. Convert to UTC midnight.
    const d = new Date(s + 'T00:00:00Z');
    return Math.floor(d.getTime() / 1000);
}

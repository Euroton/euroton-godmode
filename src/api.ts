// Typed RPC wrapper over euroton-server's /admin/v1/* surface.
//
// Token lives in localStorage under `godmode-token`; cleared on 401. No
// cookies, no refresh dance — godmode is operator-mediated, the token
// is a long-lived operator secret matching OPERATOR_TOKEN on the server.

const TOKEN_KEY = 'godmode-token';
const BASE_KEY = 'godmode-base';

// Derive a sensible default API base from where godmode is being served.
// Selfhost deploys serve godmode & /admin/* from the same origin; Caddy
// denies /admin/* on every other hostname.
// On localhost/127.0.0.1 (local dev), fall back to the Fastify dev port.
// Anywhere else, return '' so the App forces the operator to the config
// view rather than silently fetching a wrong default.
function defaultBase(): string {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:4000';
    }
    if (host.startsWith('godmode.')) {
        return window.location.origin;
    }
    return '';
}

export function getToken(): string {
    return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(t: string): void {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
}

export function getBase(): string {
    const stored = localStorage.getItem(BASE_KEY);
    // Older builds saved the public API host, which no longer serves /admin.
    if (stored && /^https?:\/\/(account|mail)-api\./.test(stored)) {
        localStorage.removeItem(BASE_KEY);
        return defaultBase();
    }
    return stored ?? defaultBase();
}
export function setBase(b: string): void {
    if (b) localStorage.setItem(BASE_KEY, b);
    else localStorage.removeItem(BASE_KEY);
}

export interface ApiError extends Error {
    status: number;
    code?: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();
    const base = getBase().replace(/\/+$/, '');
    const headers: Record<string, string> = {
        authorization: token ? `Bearer ${token}` : '',
        accept: 'application/json',
    };
    if (init?.body !== undefined) {
        headers['content-type'] = 'application/json';
    }
    const res = await fetch(`${base}${path}`, { ...init, headers });
    let body: unknown;
    try {
        body = await res.json();
    } catch {
        body = null;
    }
    if (!res.ok) {
        const e = new Error(
            // Proton-shape envelope is {Code, Error} per ADR 035 — godmode
            // /admin/* follows the same wrapper.
            (body as { Error?: string } | null)?.Error ?? `HTTP ${res.status}`,
        ) as ApiError;
        e.status = res.status;
        e.code = (body as { Code?: number } | null)?.Code;
        throw e;
    }
    return body as T;
}

export interface UserListEntry {
    ID: string;
    Username: string;
    DisplayName: string;
    Email: string;
    UsedSpace: number;
    MaxSpace: number;
    PlanID: string | null;
    PlanTitle: string | null;
    CreateTime: number;
    TwoFactor: number;
}

export interface UserListResponse {
    Code: number;
    Users: UserListEntry[];
    Total: number;
    Page: number;
    PageSize: number;
}

export function listUsers(search: string, page: number, pageSize: number): Promise<UserListResponse> {
    const params = new URLSearchParams();
    if (search) params.set('Search', search);
    params.set('Page', String(page));
    params.set('PageSize', String(pageSize));
    return call<UserListResponse>(`/admin/v1/users?${params.toString()}`);
}

export interface UserDetail {
    ID: string;
    Username: string;
    DisplayName: string;
    Email: string;
    CreateTime: number;
    UsedSpace: number;
    MaxSpace: number;
    TwoFactor: number;
    Addresses: Array<{ ID: string; Email: string }>;
    Sessions: Array<{ UID: string; CreatedAt: number; ExpiresAt: number | null; RefreshedAt: number | null }>;
    Subscription: { PlanID: string; PlanTitle: string; Cycle: number; PeriodEnd: number } | null;
    Keys: Array<{ ID: string; Fingerprint: string; Primary: number; Activated: boolean }>;
}

export interface UserDetailResponse {
    Code: number;
    User: UserDetail;
}

export function getUser(id: string): Promise<UserDetailResponse> {
    return call<UserDetailResponse>(`/admin/v1/users/${encodeURIComponent(id)}`);
}

export interface Plan {
    ID: string;
    Name: string;
    Title: string;
    Type: number;
    Services: number;
    State: number;
    Currency: string;
    Amount: number;
    Cycle: number;
    MaxSpace: number;
    MaxAddresses: number;
    MaxCalendars: number;
    MaxMembers: number;
    MaxDomains: number;
    MaxVPN: number;
    Features: number;
    Quantity: number;
    Pricing: Record<string, number>;
    MaxTier: number;
    ParentMetaPlanID: string;
}

export function listPlans(): Promise<{ Code: number; Plans: Plan[] }> {
    return call<{ Code: number; Plans: Plan[] }>('/admin/v1/plans');
}
export function getPlan(id: string): Promise<{ Code: number; Plan: Plan }> {
    return call<{ Code: number; Plan: Plan }>(`/admin/v1/plans/${encodeURIComponent(id)}`);
}
export function updatePlan(id: string, patch: Partial<Plan>): Promise<{ Code: number; Plan: Plan }> {
    return call<{ Code: number; Plan: Plan }>(`/admin/v1/plans/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
    });
}

export interface PlanAddon extends Plan {
    MaxQuantity: number | null;
}
export function listPlanAddons(baseId: string): Promise<{ Code: number; Addons: PlanAddon[] }> {
    return call<{ Code: number; Addons: PlanAddon[] }>(
        `/admin/v1/plans/${encodeURIComponent(baseId)}/addons`,
    );
}
export function updateAddonMaxQuantity(
    baseId: string,
    addonId: string,
    maxQuantity: number | null,
): Promise<{ Code: number; MaxQuantity: number | null }> {
    return call<{ Code: number; MaxQuantity: number | null }>(
        `/admin/v1/plans/${encodeURIComponent(baseId)}/addons/${encodeURIComponent(addonId)}`,
        {
            method: 'PUT',
            body: JSON.stringify({ MaxQuantity: maxQuantity }),
        },
    );
}

export interface SubscriptionUpdate {
    PlanID: string;
    Cycle?: number;
    PeriodEnd?: number;
    RenewDisabled?: boolean;
    Lifetime?: boolean;
}

export interface Subscription {
    PlanID: string;
    Cycle: number;
    PeriodStart: number;
    PeriodEnd: number;
    RenewDisabled: boolean;
    Lifetime?: boolean;
}

export function updateSubscription(
    userId: string,
    sub: SubscriptionUpdate,
): Promise<{ Code: number; Subscription: Subscription }> {
    return call<{ Code: number; Subscription: Subscription }>(
        `/admin/v1/users/${encodeURIComponent(userId)}/subscription`,
        { method: 'PUT', body: JSON.stringify(sub) },
    );
}

export interface AuditEntry {
    ID: string;
    At: number;
    ActorHash: string;
    Action: string;
    Target: string | null;
    Before: unknown;
    After: unknown;
}

export function listAudit(
    page: number,
    pageSize: number,
    action: string,
    target: string,
): Promise<{ Code: number; Entries: AuditEntry[]; Total: number }> {
    const params = new URLSearchParams();
    params.set('Page', String(page));
    params.set('PageSize', String(pageSize));
    if (action) params.set('Action', action);
    if (target) params.set('Target', target);
    return call<{ Code: number; Entries: AuditEntry[]; Total: number }>(
        `/admin/v1/audit?${params.toString()}`,
    );
}

export function listDbTables(): Promise<{ Code: number; Tables: Array<{ Name: string; ApproxRows: number }> }> {
    return call<{ Code: number; Tables: Array<{ Name: string; ApproxRows: number }> }>('/admin/v1/db/tables');
}

export function getDbTableRows(
    name: string,
    page: number,
    pageSize: number,
): Promise<{ Code: number; Columns: string[]; Rows: unknown[][] }> {
    const params = new URLSearchParams();
    params.set('Page', String(page));
    params.set('PageSize', String(pageSize));
    return call<{ Code: number; Columns: string[]; Rows: unknown[][] }>(
        `/admin/v1/db/tables/${encodeURIComponent(name)}?${params.toString()}`,
    );
}

export function runDbQuery(
    query: string,
    dangerous = false,
): Promise<{ Code: number; Columns: string[]; Rows: unknown[][]; RowCount: number }> {
    const path = dangerous ? '/admin/v1/db/query?dangerous=1' : '/admin/v1/db/query';
    return call<{ Code: number; Columns: string[]; Rows: unknown[][]; RowCount: number }>(
        path,
        { method: 'POST', body: JSON.stringify({ Query: query }) },
    );
}

export interface FeatureFlag {
    ID: string;
    Scope: string;
    Name: string;
    Enabled: boolean;
    Variant: { name?: string; enabled?: boolean; feature_enabled?: boolean };
    ImpressionData: boolean;
    CreatedAt: number;
    UpdatedAt: number;
}

export function listFlags(
    page: number,
    pageSize: number,
    scope: string,
    name: string,
): Promise<{ Code: number; Flags: FeatureFlag[]; Total: number }> {
    const params = new URLSearchParams();
    params.set('Page', String(page));
    params.set('PageSize', String(pageSize));
    if (scope) params.set('Scope', scope);
    if (name) params.set('Name', name);
    return call<{ Code: number; Flags: FeatureFlag[]; Total: number }>(
        `/admin/v1/flags?${params.toString()}`,
    );
}

export function upsertFlag(payload: {
    Scope: string;
    Name: string;
    Enabled: boolean;
    Variant?: { name?: string; enabled?: boolean; feature_enabled?: boolean };
    ImpressionData?: boolean;
}): Promise<{ Code: number; Flag: FeatureFlag }> {
    return call<{ Code: number; Flag: FeatureFlag }>('/admin/v1/flags', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteFlag(id: string): Promise<{ Code: number }> {
    return call<{ Code: number }>(`/admin/v1/flags/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}

// ─── Coupons (ADR 082) ────────────────────────────────────────────

export interface CouponRow {
    Code: string;
    Description: string;
    DiscountPercent: number | null;
    DiscountFixedAmount: number | null;
    ApplicablePlans: string[] | null;
    MaxRedemptionsPerUser: number | null;
    ValidUntil: string | null;
    CreatedAt: string;
    UpdatedAt: string;
    Redemptions?: number;
}

export interface CouponInput {
    Code?: string;
    Description?: string;
    DiscountPercent?: number | null;
    DiscountFixedAmount?: number | null;
    ApplicablePlans?: string[] | null;
    MaxRedemptionsPerUser?: number | null;
    ValidUntil?: string | null;
}

export function listCoupons(): Promise<{ Code: number; Coupons: CouponRow[] }> {
    return call<{ Code: number; Coupons: CouponRow[] }>('/admin/v1/coupons');
}

export function createCoupon(payload: CouponInput): Promise<{ Code: number; Coupon: CouponRow }> {
    return call<{ Code: number; Coupon: CouponRow }>('/admin/v1/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateCoupon(code: string, payload: CouponInput): Promise<{ Code: number; Coupon: CouponRow }> {
    return call<{ Code: number; Coupon: CouponRow }>(`/admin/v1/coupons/${encodeURIComponent(code)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteCoupon(code: string): Promise<{ Code: number }> {
    return call<{ Code: number }>(`/admin/v1/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE',
    });
}

// ─── VPN (ADR 187) ────────────────────────────────────────────────

export interface VpnServer {
    ID: string;
    Name: string;
    EntryCountry: string;
    ExitCountry: string;
    City: string | null;
    Tier: number;
    Features: number;
    Domain: string;
    EntryIP: string;
    ExitIP: string;
    Load: number;
    Status: number;
    Lat: number;
    Lon: number;
    Protocol: 'openvpn' | 'wireguard';
    ConfigBlob: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface VpnServerInput {
    Name?: string;
    EntryCountry?: string;
    ExitCountry?: string;
    City?: string | null;
    Tier?: number;
    Features?: number;
    Domain?: string;
    EntryIP?: string;
    ExitIP?: string;
    Load?: number;
    Status?: number;
    Lat?: number;
    Lon?: number;
    Protocol?: 'openvpn' | 'wireguard';
    ConfigBlob?: string | null;
}

export interface VpnCredentials {
    UserID: string;
    Name: string;
    Password: string;
    GroupID: string;
    MaxConnect: number;
    CreatedAt: string;
    UpdatedAt: string;
}

export function listVpnServers(): Promise<{ Code: number; Servers: VpnServer[] }> {
    return call<{ Code: number; Servers: VpnServer[] }>('/admin/v1/vpn/servers');
}

export function createVpnServer(
    payload: VpnServerInput,
): Promise<{ Code: number; Server: VpnServer }> {
    return call<{ Code: number; Server: VpnServer }>('/admin/v1/vpn/servers', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateVpnServer(
    id: string,
    payload: VpnServerInput,
): Promise<{ Code: number; Server: VpnServer }> {
    return call<{ Code: number; Server: VpnServer }>(
        `/admin/v1/vpn/servers/${encodeURIComponent(id)}`,
        { method: 'PUT', body: JSON.stringify(payload) },
    );
}

export function deleteVpnServer(id: string): Promise<{ Code: number }> {
    return call<{ Code: number }>(`/admin/v1/vpn/servers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}

export async function getVpnCredentials(userId: string): Promise<VpnCredentials | null> {
    try {
        const r = await call<{ Code: number; Credentials: VpnCredentials }>(
            `/admin/v1/vpn/credentials/${encodeURIComponent(userId)}`,
        );
        return r.Credentials;
    } catch (e) {
        if ((e as ApiError).status === 404) return null;
        throw e;
    }
}

export function upsertVpnCredentials(
    userId: string,
    payload: { Name: string; Password: string; GroupID?: string; MaxConnect?: number },
): Promise<{ Code: number; Credentials: VpnCredentials }> {
    return call<{ Code: number; Credentials: VpnCredentials }>(
        `/admin/v1/vpn/credentials/${encodeURIComponent(userId)}`,
        { method: 'PUT', body: JSON.stringify(payload) },
    );
}

export function deleteVpnCredentials(userId: string): Promise<{ Code: number }> {
    return call<{ Code: number }>(
        `/admin/v1/vpn/credentials/${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
    );
}

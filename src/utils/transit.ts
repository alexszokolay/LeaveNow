const API_BASE_URL = 'https://external.transitapp.com';
const DEFAULT_TIMEOUT_MS = 10_000;

type CacheEntry<T> = {
    data: T;
    expiresAt: number;
};

type CacheResult<T> = {
    data: T | null;
    stale: boolean;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): CacheResult<T> {
    const entry = cacheStore.get(key);
    if (!entry) return { data: null, stale: false };
    const stale = Date.now() > entry.expiresAt;
    return { data: entry.data as T, stale };
}

function setCached<T>(key: string, data: T, ttlMs: number) {
    cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= attempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Transit API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error as Error;
            if (attempt < attempts) {
                await delay(150 * (attempt + 1));
                continue;
            }
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError ?? new Error('Transit API request failed');
}

export async function fetchTransitJson<T>(path: string, params: Record<string, string | number | boolean | undefined>, options?: { cacheKey?: string; ttlMs?: number }) {
    const apiKey = import.meta.env.TRANSIT_API_KEY;
    if (!apiKey) {
        throw new Error('Missing TRANSIT_API_KEY');
    }

    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const cacheKey = options?.cacheKey;
    if (cacheKey && options?.ttlMs) {
        const cached = getCached<T>(cacheKey);
        if (cached.data && !cached.stale) {
            return { data: cached.data, meta: { cached: true, stale: false } };
        }
        try {
            const data = await fetchWithRetry(url.toString(), { headers: { apiKey } });
            setCached(cacheKey, data, options.ttlMs);
            return { data, meta: { cached: false, stale: false } };
        } catch (error) {
            if (cached.data) {
                return { data: cached.data, meta: { cached: true, stale: true, error: (error as Error).message } };
            }
            throw error;
        }
    }

    const data = await fetchWithRetry(url.toString(), { headers: { apiKey } });
    return { data, meta: { cached: false, stale: false } };
}

export function clampScore(score: number) {
    return Math.max(0, Math.min(100, Math.round(score)));
}

export function summarizeLeg(leg: any) {
    if (!leg) return 'Leg';
    if (leg.leg_mode === 'walk') return 'Walk';
    if (leg.leg_mode === 'personal_bike') return 'Bike';
    if (leg.leg_mode === 'shared_mobility') return 'Shared';
    if (leg.leg_mode === 'microtransit') return 'Microtransit';
    if (leg.leg_mode !== 'transit') return 'Transit';
    const route = Array.isArray(leg.routes) ? leg.routes[0] : null;
    const shortName = route?.route_short_name || route?.real_time_route_id || route?.route_long_name;
    const modeName = route?.route_mode_name || 'Transit';
    if (shortName) return `${modeName} ${shortName}`;
    return modeName;
}

export function computeReliability(results: any[]) {
    const durations = results.map((result) => result?.duration).filter((value) => Number.isFinite(value));
    const mean = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    const variance = durations.length
        ? durations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / durations.length
        : 0;
    const variability = mean ? Math.sqrt(variance) / mean : 0;

    let scheduleItems = 0;
    let realTimeItems = 0;
    let alertCount = 0;

    results.forEach((result) => {
        (result?.legs || []).forEach((leg: any) => {
            if (leg?.leg_mode === 'transit') {
                (leg?.departures || []).forEach((departure: any) => {
                    scheduleItems += 1;
                    if (departure?.is_real_time) realTimeItems += 1;
                });
                (leg?.routes || []).forEach((route: any) => {
                    alertCount += Array.isArray(route?.alerts) ? route.alerts.length : 0;
                });
            }
        });
    });

    const realTimeRate = scheduleItems ? realTimeItems / scheduleItems : 0;
    let score = 90;
    score -= Math.min(45, variability * 120);
    score -= (1 - realTimeRate) * 20;
    score -= Math.min(25, alertCount * 8);

    const clampedScore = clampScore(score);
    const level = clampedScore >= 80 ? 'High' : clampedScore >= 60 ? 'Medium' : 'Low';
    const reasons: string[] = [];

    if (variability > 0.15) reasons.push('ETAs vary across options');
    if (realTimeRate < 0.4) reasons.push('Limited real-time coverage');
    if (alertCount > 0) reasons.push('Active service alerts');
    if (reasons.length === 0) reasons.push('Stable schedule and consistent ETAs');

    return {
        score: clampedScore,
        level,
        variability,
        realTimeRate,
        alertCount,
        reasons
    };
}

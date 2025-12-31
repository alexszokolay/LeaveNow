import type { APIRoute } from 'astro';
import { fetchTransitJson } from '../../../utils/transit';

export const prerender = false;

type StopSelection = {
    global_stop_id?: string;
    stop_lat?: number;
    stop_lon?: number;
};

type PlanRequest = {
    from?: StopSelection;
    to?: StopSelection;
    timeType?: 'leave' | 'arrive';
    timeValue?: number | null;
};

function buildPlanParams(payload: PlanRequest) {
    const params: Record<string, string | number | boolean | undefined> = {
        mode: 'transit',
        should_update_realtime: true,
        num_result: 3,
        max_num_departures: 5
    };

    if (payload.from?.global_stop_id) {
        params.from_global_stop_id = payload.from.global_stop_id;
    } else if (typeof payload.from?.stop_lat === 'number' && typeof payload.from?.stop_lon === 'number') {
        params.from_lat = payload.from.stop_lat;
        params.from_lon = payload.from.stop_lon;
    }

    if (payload.to?.global_stop_id) {
        params.to_global_stop_id = payload.to.global_stop_id;
    } else if (typeof payload.to?.stop_lat === 'number' && typeof payload.to?.stop_lon === 'number') {
        params.to_lat = payload.to.stop_lat;
        params.to_lon = payload.to.stop_lon;
    }

    if (payload.timeValue !== null && payload.timeValue !== undefined) {
        if (payload.timeType === 'arrive') params.arrival_time = payload.timeValue;
        else params.leave_time = payload.timeValue;
    }

    return params;
}

export const POST: APIRoute = async ({ request }) => {
    const token = import.meta.env.TRANSIT_REFRESH_TOKEN;
    if (token) {
        const authHeader = request.headers.get('authorization') ?? '';
        if (authHeader !== `Bearer ${token}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
    }

    const body = (await request.json()) as { requests?: PlanRequest[] };
    const requests = Array.isArray(body.requests) ? body.requests : [];

    const results = [];
    for (const payload of requests) {
        const params = buildPlanParams(payload);
        const cacheKey = `plan:${JSON.stringify(params)}`;
        try {
            await fetchTransitJson('/v3/public/plan', params, { cacheKey, ttlMs: 60_000 });
            results.push({ ok: true, params });
        } catch (error) {
            results.push({ ok: false, params, error: (error as Error).message });
        }
    }

    return new Response(JSON.stringify({ refreshed: results.length, results }), {
        headers: { 'Content-Type': 'application/json' }
    });
};

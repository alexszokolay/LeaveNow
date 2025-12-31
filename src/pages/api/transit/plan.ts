import type { APIRoute } from 'astro';
import { computeReliability, fetchTransitJson, summarizeLeg } from '../../../utils/transit';

export const prerender = false;

type StopSelection = {
    global_stop_id?: string;
    stop_lat?: number;
    stop_lon?: number;
    stop_name?: string;
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

function summarizeResult(result: any) {
    const legs = Array.isArray(result?.legs) ? result.legs : [];
    const summary = legs.map(summarizeLeg).join(' / ');
    return {
        start_time: result?.start_time,
        end_time: result?.end_time,
        duration: result?.duration,
        summary,
        legs: legs.map((leg: any) => ({
            mode: leg?.leg_mode,
            label: summarizeLeg(leg),
            start_time: leg?.start_time,
            end_time: leg?.end_time,
            duration: leg?.duration
        }))
    };
}

export const POST: APIRoute = async ({ request }) => {
    const payload = (await request.json()) as PlanRequest;

    const params = buildPlanParams(payload);
    if (!params.from_global_stop_id && !params.from_lat) {
        return new Response(JSON.stringify({ error: 'Missing origin selection.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    if (!params.to_global_stop_id && !params.to_lat) {
        return new Response(JSON.stringify({ error: 'Missing destination selection.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const cacheKey = `plan:${JSON.stringify(params)}`;

    try {
        const { data, meta } = await fetchTransitJson<{ results?: unknown[] }>(
            '/v3/public/plan',
            params,
            { cacheKey, ttlMs: 60_000 }
        );

        const results = Array.isArray(data.results) ? data.results : [];
        if (results.length === 0) {
            return new Response(JSON.stringify({ error: 'No routes found for that request.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const sorted = [...results].sort((a: any, b: any) => (a?.duration ?? 0) - (b?.duration ?? 0));
        const best = summarizeResult(sorted[0]);
        const alternatives = sorted.slice(1, 3).map(summarizeResult);
        const reliability = computeReliability(results as any[]);

        return new Response(
            JSON.stringify({
                best,
                alternatives,
                reliability,
                meta
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: (error as Error).message
            }),
            {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};

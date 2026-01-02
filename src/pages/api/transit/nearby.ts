import type { APIRoute } from 'astro';
import { fetchTransitJson } from '../../../utils/transit';

export const prerender = false;

type RawStop = {
    stop?: Record<string, unknown>;
} & Record<string, unknown>;

type NormalizedStop = {
    global_stop_id?: string;
    stop_lat: number;
    stop_lon: number;
    stop_name: string;
    distance_meters?: number;
};

const toNumber = (value: unknown) => {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeStop = (item: RawStop): NormalizedStop | null => {
    const candidate = (item?.stop as Record<string, unknown>) ?? item ?? {};
    const stop_lat = toNumber(candidate.stop_lat ?? candidate.lat);
    const stop_lon = toNumber(candidate.stop_lon ?? candidate.lon);
    if (!Number.isFinite(stop_lat) || !Number.isFinite(stop_lon)) return null;
    const stop_name = String(candidate.stop_name ?? candidate.name ?? 'Stop');
    const global_stop_id = candidate.global_stop_id ? String(candidate.global_stop_id) : undefined;
    const distance_meters = toNumber(candidate.distance ?? candidate.distance_meters ?? item?.distance ?? item?.distance_meters);
    return {
        global_stop_id,
        stop_lat,
        stop_lon,
        stop_name,
        distance_meters: Number.isFinite(distance_meters) ? distance_meters ?? undefined : undefined
    };
};

export const GET: APIRoute = async ({ url }) => {
    const lat = toNumber(url.searchParams.get('lat'));
    const lon = toNumber(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return new Response(JSON.stringify({ results: [], error: 'lat and lon are required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { data, meta } = await fetchTransitJson<{ stops?: RawStop[]; results?: RawStop[] }>(
            '/v3/public/nearby_stops',
            {
                lat,
                lon,
                max_num_results: 6
            },
            {
                cacheKey: `nearby:${lat}:${lon}`,
                ttlMs: 5 * 60_000
            }
        );

        const rawStops = Array.isArray(data.stops) ? data.stops : Array.isArray(data.results) ? data.results : [];
        const normalized = rawStops.map(normalizeStop).filter(Boolean);

        return new Response(JSON.stringify({ results: normalized, meta }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        const status = (error as Error & { status?: number }).status ?? 502;
        return new Response(
            JSON.stringify({
                results: [],
                error: (error as Error).message
            }),
            {
                status,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};

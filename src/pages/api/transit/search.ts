import type { APIRoute } from 'astro';
import { fetchTransitJson } from '../../../utils/transit';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const query = url.searchParams.get('query')?.trim();
    if (!query) {
        return new Response(JSON.stringify({ results: [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    try {
        const { data, meta } = await fetchTransitJson<{ results?: unknown[] }>(
            '/v3/public/search_stops',
            {
                query,
                lat: lat ?? undefined,
                lon: lon ?? undefined,
                max_num_results: 6
            },
            {
                cacheKey: `search:${query}:${lat ?? ''}:${lon ?? ''}`,
                ttlMs: 5 * 60_000
            }
        );

        return new Response(JSON.stringify({ results: data.results ?? [], meta }), {
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

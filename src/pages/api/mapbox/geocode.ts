import type { APIRoute } from 'astro';

export const prerender = false;

type GeocodeResult = {
    label: string;
    lat: number;
    lon: number;
};

const toNumber = (value: unknown) => {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

export const GET: APIRoute = async ({ url }) => {
    const query = url.searchParams.get('query')?.trim();
    if (!query) {
        return new Response(JSON.stringify({ results: [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const token = import.meta.env.MAPBOX_TOKEN;
    try {
        let results: GeocodeResult[] = [];
        if (token) {
            const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
            endpoint.searchParams.set('access_token', token);
            endpoint.searchParams.set('limit', '3');
            endpoint.searchParams.set('autocomplete', 'true');
            endpoint.searchParams.set('types', 'address,place,poi');
            endpoint.searchParams.set('country', 'ca');
            endpoint.searchParams.set('proximity', '-79.3832,43.6532');
            endpoint.searchParams.set('bbox', '-79.6393,43.5810,-79.1153,43.8555');
            const response = await fetch(endpoint.toString());
            if (!response.ok) {
                return new Response(JSON.stringify({ results: [], error: 'Mapbox geocoding failed' }), {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const data = await response.json();
            results = (data?.features ?? [])
                .map((feature: any) => {
                    const center = feature?.center ?? [];
                    const lon = toNumber(center[0]);
                    const lat = toNumber(center[1]);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                    return {
                        label: feature?.place_name ?? feature?.text ?? query,
                        lat,
                        lon
                    };
                })
                .filter(Boolean);
        } else {
            const endpoint = new URL('https://nominatim.openstreetmap.org/search');
            endpoint.searchParams.set('format', 'json');
            endpoint.searchParams.set('q', query);
            endpoint.searchParams.set('limit', '3');
            endpoint.searchParams.set('countrycodes', 'ca');
            endpoint.searchParams.set('bounded', '1');
            endpoint.searchParams.set('viewbox', '-79.6393,43.8555,-79.1153,43.5810');
            const response = await fetch(endpoint.toString(), {
                headers: { 'User-Agent': 'LeaveNow/1.0' }
            });
            if (!response.ok) {
                return new Response(JSON.stringify({ results: [], error: 'Geocoding failed' }), {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const data = await response.json();
            results = (data ?? [])
                .map((item: any) => {
                    const lat = toNumber(item?.lat);
                    const lon = toNumber(item?.lon);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                    return {
                        label: item?.display_name ?? query,
                        lat,
                        lon
                    };
                })
                .filter(Boolean);
        }

        return new Response(JSON.stringify({ results }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                results: [],
                error: (error as Error).message
            }),
            {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};

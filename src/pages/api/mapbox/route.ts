import type { APIRoute } from 'astro';

export const prerender = false;

type RouteRequest = {
    profile?: string;
    coordinates?: Array<[number, number]>;
};

export const POST: APIRoute = async ({ request }) => {
    const token = import.meta.env.MAPBOX_TOKEN;
    if (!token) {
        return new Response(JSON.stringify({ error: 'Missing MAPBOX_TOKEN' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const payload = (await request.json()) as RouteRequest;
    const coords = Array.isArray(payload.coordinates) ? payload.coordinates : [];
    if (coords.length < 2) {
        return new Response(JSON.stringify({ error: 'At least two coordinates are required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const profile = payload.profile ?? 'driving';
    const path = coords.map(([lon, lat]) => `${lon},${lat}`).join(';');
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${path}`);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('access_token', token);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            return new Response(JSON.stringify({ error: 'Mapbox route failed' }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const data = await response.json();
        const route = data?.routes?.[0];
        return new Response(JSON.stringify({ geometry: route?.geometry ?? null }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: (error as Error).message
            }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

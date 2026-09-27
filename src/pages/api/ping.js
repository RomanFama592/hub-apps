import fetch from 'node-fetch';

export const POST = async ({ request }) => {
    const { url } = await request.json();
    try {
        // Hacemos un ping HTTP rápido (timeout de 3 segundos)
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        return new Response(JSON.stringify({ active: res.ok }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ active: false }), { status: 200 });
    }
}
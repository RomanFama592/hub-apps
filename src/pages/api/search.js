import fetch from 'node-fetch';

export const POST = async ({ request }) => {
    const { query } = await request.json();
    // Ejemplo usando la API gratuita de Unsplash (o puedes cambiarla por Google Custom Search si tienes Key)
    // Para simplificar sin Keys, usaremos imágenes aleatorias basadas en el término
    const mockImages = [
        `https://source.unsplash.com/400x400/?${encodeURIComponent(query)},logo`,
        `https://source.unsplash.com/400x400/?${encodeURIComponent(query)},app`,
        `https://source.unsplash.com/400x400/?${encodeURIComponent(query)},icon`
    ];
    return new Response(JSON.stringify({ images: mockImages }), { status: 200 });
}
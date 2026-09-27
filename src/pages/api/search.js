import fetch from 'node-fetch';

export const POST = async ({ request }) => {
    const { query } = await request.json();
    const images = [];

    try {
        // 1. Intento principal: Buscar en el repositorio "dashboard-icons" de GitHub
        // Limpiamos el nombre (ej: "Pi-Hole" se convierte en "pihole")
        const cleanName = query.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        const githubIconUrl = `https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/${cleanName}.png`;
        
        // Verificamos rápidamente si el icono existe en el repositorio
        const githubRes = await fetch(githubIconUrl, { method: 'HEAD' });
        if (githubRes.ok) {
            images.push(githubIconUrl);
        }

        // 2. Intento de respaldo: Scraper de Bing (Mucho más estricto)
        // Añadimos "app icon" a la búsqueda y filtramos por imágenes de formato cuadrado
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query + ' app icon')}&qft=+filterui:aspect-square`;
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });
        
        const html = await response.text();

        // Regex mejorado: Solo atrapa URLs que terminan sí o sí en png/jpg/webp y pertenecen al atributo de imagen
        const regex = /&quot;murl&quot;:&quot;(https:\/\/[^&]+?\.(?:png|jpg|jpeg|webp))&quot;/gi;
        let match;
        
        // Limitamos a 3 para no saturar el menú
        while ((match = regex.exec(html)) !== null && images.length < 3) {
            if (!images.includes(match[1])) {
                images.push(match[1]);
            }
        }

        // 3. Fallback: Si no encuentra nada, crea una imagen con la inicial del servicio
        if (images.length === 0) {
            images.push(`https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=random&size=400`);
        }

        return new Response(JSON.stringify({ images }), { status: 200 });
        
    } catch (error) {
        console.error("Error en búsqueda:", error);
        const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=random&size=400`;
        return new Response(JSON.stringify({ images: [fallbackImage] }), { status: 200 });
    }
}
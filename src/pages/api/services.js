import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

export const POST = async ({ request }) => {
    const data = await request.json();
    let localImagePath = data.imageUrl;

    // Si es un link, la descargamos para guardarla localmente
    if (data.imageUrl && data.imageUrl.startsWith('http')) {
        try {
            const response = await fetch(data.imageUrl);
            const buffer = await response.arrayBuffer();
            const filename = `${Date.now()}-${data.name.replace(/\s+/g, '')}.jpg`;
            const filepath = path.join(process.cwd(), 'public/assets', filename);
            
            await fs.writeFile(filepath, Buffer.from(buffer));
            localImagePath = `/assets/${filename}`;
        } catch (error) {
            console.error("Error descargando la imagen, se usará el link original");
        }
    }

    // Actualizar config.json
    const configPath = path.join(process.cwd(), 'data/config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    config.services.push({
        id: Date.now().toString(),
        name: data.name,
        description: data.description,
        url: data.url,
        image: localImagePath
    });

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
}
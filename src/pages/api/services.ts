import fs from 'fs/promises';
import path from 'path';

import type { Config } from '../../types/hub';

// 1. Extrae las iniciales del nombre (hasta 2 letras)
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// 2. Genera un archivo SVG con las iniciales y un gradiente estético
function generateInitialsSVG(name: string): string {
  const initials = getInitials(name);

  // Paleta de gradientes estilo Fluent / Modern Dark
  const gradients = [
    { start: '#3b82f6', end: '#1d4ed8' }, // Azul
    { start: '#6366f1', end: '#4338ca' }, // Índigo
    { start: '#8b5cf6', end: '#6d28d9' }, // Púrpura
    { start: '#06b6d4', end: '#0e7490' }, // Cían
    { start: '#10b981', end: '#047857' }, // Esmeralda
    { start: '#f59e0b', end: '#b45309' }, // Ámbar
    { start: '#64748b', end: '#334155' }  // Pizarra / Gris
  ];

  // Asigna siempre el mismo gradiente según el nombre del servicio
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = gradients[hash % gradients.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.start}" />
      <stop offset="100%" stop-color="${color.end}" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg-grad)" />
  <text x="50%" y="54%" 
        dominant-baseline="middle" 
        text-anchor="middle" 
        fill="#FFFFFF" 
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="200" 
        font-weight="700" 
        letter-spacing="4">
    ${initials}
  </text>
</svg>`.trim();
}

export const POST = async ({ request }: { request: Request }) => {
    const data = await request.json();
    let localImagePath = "";
    let isDownloaded = false;

    // Normalizar nombre de archivo (ej: "Home Assistant" -> "homeassistant")
    const sanitizedName = data.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'service';

    // PASO 1: Intentar descargar si se proporcionó una URL remota
    if (data.imageUrl && data.imageUrl.startsWith('http')) {
        try {
            const response = await fetch(data.imageUrl);
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const filename = `${Date.now()}-${sanitizedName}.jpg`;
                const filepath = path.join(process.cwd(), 'public/assets', filename);
                
                await fs.writeFile(filepath, Buffer.from(buffer));
                localImagePath = `/assets/${filename}`;
                isDownloaded = true;
            }
        } catch (error) {
            console.error(`Error al descargar la imagen remota para "${data.name}". Generando avatar...`);
        }
    }

    // PASO 2: Si no hay URL o falló la descarga, generar el SVG con iniciales
    if (!isDownloaded) {
        const svgContent = generateInitialsSVG(data.name);
        const filename = `${Date.now()}-${sanitizedName}-initials.svg`;
        const filepath = path.join(process.cwd(), 'public/assets', filename);
        
        await fs.writeFile(filepath, svgContent, 'utf-8');
        localImagePath = `/assets/${filename}`;
    }

    // PASO 3: Guardar los datos actualizados en config.json
    const configPath = path.join(process.cwd(), 'data/config.json');
    let config: Config = { maxPerPage: 10, services: [] };

    try {
        const content = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(content);
    } catch (e) {
        // Si no existe config.json, creamos la estructura por defecto
    }

    config.services.push({
        id: Date.now().toString(),
        name: data.name,
        description: data.description || '',
        url: data.url,
        image: localImagePath
    });

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return new Response(JSON.stringify({ success: true, image: localImagePath }), { status: 200 });
};
import fs from 'fs/promises';
import path from 'path';
import type { Config } from '../../types/hub';
import { generateInitialsSVG } from '../../lib/avatar';

// Helper para procesar/descargar imagen o generar el SVG de iniciales
async function processServiceImage(name: string, imageUrl?: string): Promise<string> {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'service';

  if (imageUrl && imageUrl.startsWith('http')) {
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const filename = `${Date.now()}-${sanitizedName}.jpg`;
        const filepath = path.join(process.cwd(), 'public/assets', filename);
        await fs.writeFile(filepath, Buffer.from(buffer));
        return `/assets/${filename}`;
      }
    } catch (error) {
      console.error(`Error descargando imagen para "${name}". Generando avatar por defecto...`);
    }
  }

  // Generar SVG si falló la descarga o no se proporcionó URL
  const svgContent = generateInitialsSVG(name);
  const filename = `${Date.now()}-${sanitizedName}-initials.svg`;
  const filepath = path.join(process.cwd(), 'public/assets', filename);
  await fs.writeFile(filepath, svgContent, 'utf-8');
  return `/assets/${filename}`;
}

// Helper para leer la configuración
async function getConfig(): Promise<{ config: Config; configPath: string }> {
  const configPath = path.join(process.cwd(), 'data/config.json');
  let config: Config = { maxPerPage: 10, services: [] };
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content) as Config;
  } catch (e) {
    // Si no existe, se creará uno nuevo
  }
  return { config, configPath };
}

// --------------------------------------------------------------------------
// METODO POST: CREAR SERVICIO
// --------------------------------------------------------------------------
export const POST = async ({ request }: { request: Request }) => {
  const data = await request.json();
  const localImagePath = await processServiceImage(data.name, data.imageUrl);
  const { config, configPath } = await getConfig();

  const newService = {
    id: Date.now().toString(),
    name: data.name,
    description: data.description || '',
    url: data.url,
    image: localImagePath
  };

  config.services.push(newService);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return new Response(JSON.stringify({ success: true, service: newService }), { status: 200 });
};

// --------------------------------------------------------------------------
// METODO PUT: EDITAR SERVICIO
// --------------------------------------------------------------------------
export const PUT = async ({ request }: { request: Request }) => {
  const data = await request.json();
  if (!data.id) {
    return new Response(JSON.stringify({ error: "Falta el ID del servicio" }), { status: 400 });
  }

  const { config, configPath } = await getConfig();
  const index = config.services.findIndex((s) => s.id === data.id);

  if (index === -1) {
    return new Response(JSON.stringify({ error: "Servicio no encontrado" }), { status: 404 });
  }

  let imagePath = config.services[index].image;

  // Si proporcionó una nueva URL de imagen
  if (data.imageUrl && data.imageUrl !== imagePath) {
    imagePath = await processServiceImage(data.name, data.imageUrl);
  } else if (data.name !== config.services[index].name && imagePath?.endsWith('-initials.svg')) {
    // Si cambió el nombre y la imagen era el SVG de iniciales, regenerarlo con el nuevo nombre
    imagePath = await processServiceImage(data.name);
  }

  config.services[index] = {
    ...config.services[index],
    name: data.name,
    description: data.description || '',
    url: data.url,
    image: imagePath
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return new Response(JSON.stringify({ success: true, service: config.services[index] }), { status: 200 });
};

// --------------------------------------------------------------------------
// METODO DELETE: ELIMINAR SERVICIO
// --------------------------------------------------------------------------
export const DELETE = async ({ request }: { request: Request }) => {
  const data = await request.json();
  if (!data.id) {
    return new Response(JSON.stringify({ error: "Falta el ID del servicio" }), { status: 400 });
  }

  const { config, configPath } = await getConfig();
  const serviceToDelete = config.services.find((s) => s.id === data.id);

  // Opcional: Eliminar la imagen local del almacenamiento si está en /assets/
  if (serviceToDelete?.image?.startsWith('/assets/')) {
    try {
      const filename = path.basename(serviceToDelete.image);
      const imgPath = path.join(process.cwd(), 'public/assets', filename);
      await fs.unlink(imgPath);
    } catch (e) {
      // Ignorar si el archivo no existía físicamente
    }
  }

  config.services = config.services.filter((s) => s.id !== data.id);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
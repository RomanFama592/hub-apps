// src/pages/api/services.ts
import {
  processServiceImage,
  cleanupOrphanedImages
} from '../../lib/regenerateImages';
import { getConfig, saveConfig } from '../../lib/config';

// --------------------------------------------------------------------------
// MÉTODO POST: CREAR SERVICIO
// --------------------------------------------------------------------------
export const POST = async ({ request }: { request: Request }) => {
  const data = await request.json();
  const id = Date.now().toString();

  const { imagePath } = await processServiceImage(id, data.name, data.imageUrl);
  const { config } = await getConfig();

  const newService = {
    id,
    name: data.name,
    description: data.description || '',
    url: data.url,
    image: imagePath,
    imageUrlOriginal: data.imageUrl || null
  };

  config.services.push(newService);
  await saveConfig(config);
  await cleanupOrphanedImages(config.services);

  return new Response(JSON.stringify({ success: true, service: newService }), { status: 200 });
};

// --------------------------------------------------------------------------
// MÉTODO PUT: EDITAR SERVICIO
// --------------------------------------------------------------------------
export const PUT = async ({ request }: { request: Request }) => {
  const data = await request.json();
  if (!data.id) {
    return new Response(JSON.stringify({ error: "Falta el ID del servicio" }), { status: 400 });
  }

  const { config } = await getConfig();
  const index = config.services.findIndex((s) => s.id === data.id);

  if (index === -1) {
    return new Response(JSON.stringify({ error: "Servicio no encontrado" }), { status: 404 });
  }

  const currentService = config.services[index];
  let imagePath = currentService.image;

  // Si se proporcionó una nueva URL de imagen o cambió con respecto a la original
  if (data.imageUrl && data.imageUrl !== currentService.imageUrlOriginal) {
    const result = await processServiceImage(currentService.id, data.name, data.imageUrl);
    imagePath = result.imagePath;
  } else if (data.name !== currentService.name && imagePath?.endsWith('-initials.svg')) {
    // Si cambió el nombre y la imagen era el SVG de iniciales, regenerar con el nuevo nombre
    const result = await processServiceImage(currentService.id, data.name, null);
    imagePath = result.imagePath;
  }

  config.services[index] = {
    ...currentService,
    name: data.name,
    description: data.description || '',
    url: data.url,
    image: imagePath,
    imageUrlOriginal: data.imageUrl || null
  };

  await saveConfig(config);
  await cleanupOrphanedImages(config.services);

  return new Response(JSON.stringify({ success: true, service: config.services[index] }), { status: 200 });
};

// --------------------------------------------------------------------------
// MÉTODO DELETE: ELIMINAR SERVICIO
// --------------------------------------------------------------------------
export const DELETE = async ({ request }: { request: Request }) => {
  const data = await request.json();
  if (!data.id) {
    return new Response(JSON.stringify({ error: "Falta el ID del servicio" }), { status: 400 });
  }

  const { config } = await getConfig();
  config.services = config.services.filter((s) => s.id !== data.id);

  await saveConfig(config);
  // Limpia automáticamente la imagen que ha quedado huérfana
  await cleanupOrphanedImages(config.services);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};